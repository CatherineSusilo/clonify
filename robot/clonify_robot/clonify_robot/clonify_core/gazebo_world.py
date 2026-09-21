"""CBM -> Gazebo world (SDF) export.

Turns a compiled Clonify Building Model (.cbm) into an SDF world file that
**Gazebo Sim (formerly Ignition Gazebo)** can load, so the *same* building
the client set up in the web app becomes a physics simulation the ROS 2
robot stack can drive and train in — on the robot's own OS, not just the
browser preview.

Why Gazebo/SDF: it is the standard open-source robotics simulator, it
integrates natively with ROS 2 (ros_gz), and an SDF world loads unchanged on
a developer laptop or the robot's compute. The exported world reconstructs
each floor as a ground plane at its real elevation and extrudes the
blueprint walls (the non-walkable cells bordering walkable space) as static
collision boxes — enough geometry for LiDAR/depth simulation, navigation and
obstacle-avoidance training.

For NVIDIA Isaac Sim users: Isaac imports SDF/URDF directly (Isaac Sim's
`omni.importer.urdf` / SDF import), so this same world file is the bridge
there too; the higher-fidelity Isaac path is documented in robot/README.md.

Usage (also exposed as the `world_export` console script):
    python3 -m clonify_robot.clonify_core.gazebo_world building.cbm world.sdf
"""
from __future__ import annotations

import sys
import xml.sax.saxutils as sax

from .cbm import load_cbm, CbmModel

WALL_HEIGHT_M = 2.6
WALL_THICKNESS_FACTOR = 1.0  # box size = cellSize (already ~wall footprint)


def _walls_for_floor(floor):
    """Yield (cx, cy) grid cells that are walls: non-walkable cells that border
    walkable space (matches the dashboard's 3D wall extrusion)."""
    cols, rows, cells = floor.cols, floor.rows, floor.walkable
    def walk(x, y):
        return 0 <= x < cols and 0 <= y < rows and cells[y * cols + x] == 1
    for y in range(rows):
        for x in range(cols):
            if walk(x, y):
                continue
            if walk(x + 1, y) or walk(x - 1, y) or walk(x, y + 1) or walk(x, y - 1):
                yield x, y


def cbm_to_sdf(model: CbmModel, wall_height: float = WALL_HEIGHT_M) -> str:
    name = sax.escape(str(model.building.get("name", "clonify_building")))
    parts = [
        '<?xml version="1.0" ?>',
        '<sdf version="1.9">',
        f'  <world name="{sax.escape("clonify")}">',
        '    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>',
        '    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors">',
        '      <render_engine>ogre2</render_engine>',
        '    </plugin>',
        '    <light type="directional" name="sun">',
        '      <direction>-0.4 -0.3 -0.9</direction>',
        '      <diffuse>1 1 1 1</diffuse><specular>0.3 0.3 0.3 1</specular><cast_shadows>true</cast_shadows>',
        '    </light>',
        f'    <model name="{name}"><static>true</static>',
    ]

    # CBM (x, y, elevation) maps directly to SDF world (x, y, z); z is up.
    link_id = 0
    for floor in model.floors:
        cs = floor.cell_size
        w = floor.cols * cs
        d = floor.rows * cs
        z = floor.elevation
        # floor slab (thin box) as a walkable ground surface for this level
        parts.append(_box_link(f"floor_{floor.level}", w / 2, d / 2, z + 0.02, w, d, 0.04))
        # walls extruded upward from the floor
        for (cx, cy) in _walls_for_floor(floor):
            x = (cx + 0.5) * cs
            y = (cy + 0.5) * cs
            parts.append(_box_link(
                f"wall_{link_id}", x, y, z + wall_height / 2,
                cs * WALL_THICKNESS_FACTOR, cs * WALL_THICKNESS_FACTOR, wall_height))
            link_id += 1

    parts.append('    </model>')
    parts.append('  </world>')
    parts.append('</sdf>')
    return "\n".join(parts)


def _box_link(link_name, cx, cy, cz, sx, sy, sz):
    """A static box centred at SDF world (cx, cy, cz) with size (sx, sy, sz)."""
    return (
        f'      <link name="{sax.escape(link_name)}">\n'
        f'        <pose>{cx:.3f} {cy:.3f} {cz:.3f} 0 0 0</pose>\n'
        f'        <collision name="c"><geometry><box><size>{sx:.3f} {sy:.3f} {sz:.3f}</size></box></geometry></collision>\n'
        f'        <visual name="v"><geometry><box><size>{sx:.3f} {sy:.3f} {sz:.3f}</size></box></geometry>\n'
        f'          <material><ambient>0.05 0.18 0.1 1</ambient><diffuse>0.1 0.4 0.2 1</diffuse></material>\n'
        f'        </visual>\n'
        f'      </link>'
    )


def export_file(cbm_path: str, sdf_path: str) -> str:
    with open(cbm_path) as fh:
        model = load_cbm(fh.read())
    sdf = cbm_to_sdf(model)
    with open(sdf_path, "w") as fh:
        fh.write(sdf)
    return sdf_path


def main():
    if len(sys.argv) != 3:
        print("usage: world_export <building.cbm> <world.sdf>", file=sys.stderr)
        sys.exit(1)
    out = export_file(sys.argv[1], sys.argv[2])
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
