"""Unit tests for the ROS-free core: CBM parsing + Dijkstra routing.

Run without a ROS install:  python3 -m pytest robot/clonify_robot/test
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from clonify_robot.clonify_core.cbm import load_cbm, CbmError  # noqa: E402
from clonify_robot.clonify_core.dijkstra import dijkstra, nearest_node  # noqa: E402
from clonify_robot.clonify_core.gazebo_world import cbm_to_sdf  # noqa: E402


def make_doc():
    """3×3 walkable ground floor + 1×3 corridor upstairs, one elevator."""
    def grid_nodes(level, cols, rows, cells, cell_size=1.0):
        nodes, edges = [], []
        walk = lambda x, y: 0 <= x < cols and 0 <= y < rows and cells[y * cols + x] == 1
        for y in range(rows):
            for x in range(cols):
                if not walk(x, y):
                    continue
                nid = f'f{level}:{x},{y}'
                nodes.append({'id': nid, 'floor': level, 'x': (x + .5) * cell_size, 'y': (y + .5) * cell_size, 'type': 'cell'})
                if walk(x + 1, y):
                    edges.append({'a': nid, 'b': f'f{level}:{x+1},{y}', 'w': cell_size, 'kind': 'walk'})
                if walk(x, y + 1):
                    edges.append({'a': nid, 'b': f'f{level}:{x},{y+1}', 'w': cell_size, 'kind': 'walk'})
        return nodes, edges

    g0 = [1] * 9
    g1 = [1, 1, 1]
    n0, e0 = grid_nodes(0, 3, 3, g0)
    n1, e1 = grid_nodes(1, 3, 1, g1)
    nodes = n0 + n1 + [
        {'id': 'elev:1:0', 'floor': 0, 'x': 2.5, 'y': 2.5, 'type': 'elevator'},
        {'id': 'elev:1:1', 'floor': 1, 'x': 2.5, 'y': 0.5, 'type': 'elevator'},
    ]
    edges = e0 + e1 + [
        {'a': 'elev:1:0', 'b': 'f0:2,2', 'w': 0.1, 'kind': 'walk'},
        {'a': 'elev:1:1', 'b': 'f1:2,0', 'w': 0.1, 'kind': 'walk'},
        {'a': 'elev:1:0', 'b': 'elev:1:1', 'w': 15, 'kind': 'elevator'},
    ]
    return {
        'magic': 'CBM1',
        'version': 1,
        'building': {'id': 1, 'name': 'Test Tower'},
        'floors': [
            {'level': 0, 'name': 'G', 'elevation': 0, 'height': 3,
             'grid': {'cols': 3, 'rows': 3, 'cellSize': 1.0, 'walkableRle': [9, 1]}},
            {'level': 1, 'name': 'F1', 'elevation': 3, 'height': 3,
             'grid': {'cols': 3, 'rows': 1, 'cellSize': 1.0, 'walkableRle': [3, 1]}},
        ],
        'graph': {'nodes': nodes, 'edges': edges},
        'pois': [],
        'elevators': [{
            'id': 1, 'label': 'Elevator A', 'doorType': 'single_door',
            'cells': {'0': {'x': 2, 'y': 2}, '1': {'x': 2, 'y': 0}},
            'panel': {'keys': [{'index': 3, 'label': '1', 'floor': 1}], 'callKeyIndex': 0},
            'panelHeightMm': 1200, 'callButtonHeightMm': 1050, 'calibrated': True,
        }],
        'charging': [{'nodeId': 'f0:0,0', 'floor': 0, 'x': 0, 'y': 0}],
    }


def test_parse_and_walkable():
    model = load_cbm(make_doc())
    assert model.version == 1
    assert model.is_walkable(0, 1.5, 1.5)
    assert not model.is_walkable(0, 9.0, 1.5)
    assert model.floor(1).cols == 3


def test_bad_magic():
    doc = make_doc()
    doc['magic'] = 'NOPE'
    try:
        load_cbm(doc)
        assert False, 'expected CbmError'
    except CbmError:
        pass


def test_same_floor_route():
    model = load_cbm(make_doc())
    path, cost = dijkstra(model, 'f0:0,0', 'f0:2,2')
    assert path[0] == 'f0:0,0' and path[-1] == 'f0:2,2'
    assert abs(cost - 4.0) < 1e-9  # manhattan across the 3×3 grid


def test_multi_floor_route_uses_elevator():
    model = load_cbm(make_doc())
    path, cost = dijkstra(model, 'f0:0,0', 'f1:0,0')
    assert 'elev:1:0' in path and 'elev:1:1' in path
    assert cost > 15  # includes the elevator ride weight


def test_nearest_node():
    model = load_cbm(make_doc())
    assert nearest_node(model, 0, 0.4, 0.4) == 'f0:0,0'


def test_elevator_profile_key_lookup():
    model = load_cbm(make_doc())
    elev = model.elevators[0]
    assert elev.key_for_floor(1)['index'] == 3
    assert elev.key_for_floor(7) is None
    assert elev.door_type == 'single_door'


def test_gazebo_world_export():
    model = load_cbm(make_doc())
    sdf = cbm_to_sdf(model)
    # valid-ish SDF with a world, the building model, floor slabs and walls
    assert sdf.startswith('<?xml')
    assert '<sdf version="1.9">' in sdf and '</sdf>' in sdf
    assert '<world name="clonify">' in sdf
    assert 'floor_0' in sdf and 'floor_1' in sdf  # both levels exported
    assert sdf.count('<link') == sdf.count('</link>')  # balanced links


def test_gazebo_world_extrudes_walls():
    # A 3x3 floor with the centre cell blocked yields wall geometry.
    doc = make_doc()
    doc['floors'][0]['grid']['walkableRle'] = [4, 1, 1, 0, 4, 1]  # centre (1,1) = wall
    model = load_cbm(doc)
    sdf = cbm_to_sdf(model)
    assert sdf.count('<link name="wall_') > 0
