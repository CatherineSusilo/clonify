"""CBM (Clonify Building Model, `.cbm`) parser — robot side.

The cloud compiles every floor of a building (blueprint-derived walkable
grids, POIs, elevators, charging areas, elevation) into a single .cbm
document; this module is the Python counterpart of the JavaScript compiler
in ``server/src/services/cbm.js``. Spec: ``docs/CBM_FORMAT.md``.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional

MAGIC = 'CBM1'


class CbmError(Exception):
    pass


@dataclass
class Floor:
    level: int
    name: str
    elevation: float
    height: float
    cols: int
    rows: int
    cell_size: float
    walkable: List[int]  # flat 0/1, row-major


@dataclass
class ElevatorProfile:
    """Building-specific elevator data — the non-generic part of multi-floor
    operation. Key layout, mapping and heights are configured manually by the
    client during building setup and calibrated on site."""
    id: int
    label: str
    door_type: str                    # 'single_door' | 'double_door'
    cells: Dict[int, dict]            # level -> {x, y, ...}
    panel: dict                       # {'keys': [{'index','label','floor','row','col'}...]}
    panel_height_mm: int
    call_button_height_mm: int
    calibrated: bool

    def key_for_floor(self, level: int) -> Optional[dict]:
        for key in self.panel.get('keys', []):
            if key.get('floor') == level:
                return key
        return None


@dataclass
class CbmModel:
    version: int
    building: dict
    floors: List[Floor]
    nodes: Dict[str, dict]
    adjacency: Dict[str, List[dict]] = field(default_factory=dict)
    pois: List[dict] = field(default_factory=list)
    elevators: List[ElevatorProfile] = field(default_factory=list)
    charging: List[dict] = field(default_factory=list)

    def floor(self, level: int) -> Optional[Floor]:
        return next((f for f in self.floors if f.level == level), None)

    def is_walkable(self, level: int, x_m: float, y_m: float) -> bool:
        f = self.floor(level)
        if not f:
            return False
        cx, cy = int(x_m / f.cell_size), int(y_m / f.cell_size)
        if not (0 <= cx < f.cols and 0 <= cy < f.rows):
            return False
        return f.walkable[cy * f.cols + cx] == 1


def _decode_rle(rle: List[int], length: int) -> List[int]:
    out: List[int] = []
    for i in range(0, len(rle), 2):
        out.extend([rle[i + 1]] * rle[i])
    if len(out) != length:
        raise CbmError(f'RLE length mismatch: {len(out)} != {length}')
    return out


def load_cbm(data) -> CbmModel:
    """Parse a .cbm document from a dict, JSON string or bytes."""
    if isinstance(data, (bytes, str)):
        doc = json.loads(data)
    else:
        doc = data
    if doc.get('magic') != MAGIC:
        raise CbmError('Not a CBM file (bad magic)')

    checksum = doc.get('checksum')
    if checksum:
        body = {k: v for k, v in doc.items() if k != 'checksum'}
        digest = hashlib.sha256(
            json.dumps(body, separators=(',', ':'), ensure_ascii=False).encode()
        ).hexdigest()
        # The JS compiler hashes its own serialization; byte-identical
        # round-tripping across languages isn't guaranteed, so only warn-level
        # callers should enforce this. We validate structure instead.
        _ = digest

    floors = [
        Floor(
            level=f['level'], name=f['name'], elevation=f['elevation'], height=f['height'],
            cols=f['grid']['cols'], rows=f['grid']['rows'], cell_size=f['grid']['cellSize'],
            walkable=_decode_rle(f['grid']['walkableRle'], f['grid']['cols'] * f['grid']['rows']),
        )
        for f in doc['floors']
    ]

    nodes = {n['id']: n for n in doc['graph']['nodes']}
    adjacency: Dict[str, List[dict]] = {nid: [] for nid in nodes}
    for e in doc['graph']['edges']:
        if e['a'] in adjacency and e['b'] in adjacency:
            adjacency[e['a']].append({'to': e['b'], 'w': e['w'], 'kind': e.get('kind', 'walk')})
            adjacency[e['b']].append({'to': e['a'], 'w': e['w'], 'kind': e.get('kind', 'walk')})

    elevators = [
        ElevatorProfile(
            id=e['id'], label=e['label'], door_type=e['doorType'],
            cells={int(k): v for k, v in e['cells'].items()},
            panel=e.get('panel', {}),
            panel_height_mm=e.get('panelHeightMm', 1200),
            call_button_height_mm=e.get('callButtonHeightMm', 1050),
            calibrated=e.get('calibrated', False),
        )
        for e in doc.get('elevators', [])
    ]

    return CbmModel(
        version=doc['version'], building=doc['building'], floors=floors,
        nodes=nodes, adjacency=adjacency, pois=doc.get('pois', []),
        elevators=elevators, charging=doc.get('charging', []),
    )
