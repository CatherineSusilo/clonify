"""Tests for the local building-model AI (room classification + POI policy)."""
import os
import sys

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)

from local_model import classify_room, enrich_pois  # noqa: E402


def test_categories():
    assert classify_room("Office A")["category"] == "delivery"
    assert classify_room("Sir Henry Pellatt's Bedroom")["category"] == "delivery"
    assert classify_room("Lobby")["category"] == "common"
    assert classify_room("Wine Cellar")["category"] == "service"
    assert classify_room("Charging Dock")["category"] == "charging"
    for restricted in ("Void", "Elevator", "Furnace Room", "Electrical", "Mechanical"):
        assert classify_room(restricted)["category"] == "restricted", restricted


def test_enrich_drops_restricted_and_promotes_charging():
    pois = [
        {"id": "a", "type": "unit", "label": "Office"},
        {"id": "b", "type": "unit", "label": "Elevator"},      # restricted → dropped
        {"id": "c", "type": "unit", "label": "Charging Room"},  # → charging
    ]
    out = enrich_pois(pois)
    labels = {p["label"]: p for p in out}
    assert "Elevator" not in labels                 # restricted removed
    assert labels["Office"]["deliverable"] is True
    assert labels["Charging Room"]["type"] == "charging"
