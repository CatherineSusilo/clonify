"""Dijkstra best-route planning over the CBM nav graph — the same
algorithm the cloud dispatcher runs (server/src/services/dijkstra.js), so a
route computed on either side is identical. Generic across all robots."""
from __future__ import annotations

import heapq
import math
from typing import Dict, List, Optional, Tuple

from .cbm import CbmModel


def dijkstra(model: CbmModel, start_id: str, goal_id: str) -> Optional[Tuple[List[str], float]]:
    if start_id not in model.adjacency or goal_id not in model.adjacency:
        return None
    dist: Dict[str, float] = {start_id: 0.0}
    prev: Dict[str, str] = {}
    heap: List[Tuple[float, str]] = [(0.0, start_id)]
    done = set()
    while heap:
        d, u = heapq.heappop(heap)
        if u in done:
            continue
        done.add(u)
        if u == goal_id:
            break
        for edge in model.adjacency[u]:
            nd = d + edge['w']
            if nd < dist.get(edge['to'], math.inf):
                dist[edge['to']] = nd
                prev[edge['to']] = u
                heapq.heappush(heap, (nd, edge['to']))
    if goal_id not in done:
        return None
    path = [goal_id]
    while path[-1] != start_id:
        path.append(prev[path[-1]])
    path.reverse()
    return path, dist[goal_id]


def nearest_node(model: CbmModel, level: int, x: float, y: float) -> Optional[str]:
    best, best_d = None, math.inf
    for nid, n in model.nodes.items():
        if n['floor'] != level:
            continue
        d = (n['x'] - x) ** 2 + (n['y'] - y) ** 2
        if d < best_d:
            best, best_d = nid, d
    return best
