"""Clonify local building-model AI.

This is the *local* model that turns a raw floor plan into a semantically
structured 3D building — it runs entirely on-device with no downloaded
weights and no network, which is the complement to the optional ML wall
segmenter (`dl_segment.py`). Two kinds of "AI" cooperate here:

  1. a learned/geometric perception front-end (the OpenCV pipeline in
     analyze.py, or the optional ONNX segmenter) that recovers WHERE the
     walls and open space are, and
  2. this local rule-based / expert-system reasoner that recovers WHAT each
     space is — classifying every room from its label and deciding how the
     robot should treat it (deliverable destination, common area to pass
     through, service room, charging candidate, or restricted no-go).

Keeping the semantics in a small, inspectable, deterministic model is a
deliberate choice: it needs no training data, is auditable, runs in
microseconds, and gives the 3D builder + dispatcher room meaning that a pure
pixel segmenter does not. Drop-in ML can still override perception; this
layer stays local.
"""

# Category → (keywords that imply it). Order matters: earlier categories win,
# so "electrical closet" is restricted (mechanical) before it is a service
# "closet". Keywords are matched case-insensitively as substrings.
_RULES = [
    ("restricted", ["void", "shaft", "elevator", "elev", "mechanical", "electrical",
                     "furnace", "boiler", "fuel", "vault", "duct", "chase", "riser"]),
    ("charging", ["charg", "dock"]),
    ("service", ["storage", "closet", "wardrobe", "utility", "kitchen", "laundry",
                 "washroom", "powder", "bath", "toilet", "pantry", "server", "it room",
                 "wine cellar", "cellar", "paint shop", "organ", "waste"]),
    ("common", ["lobby", "hall", "corridor", "gallery", "conference", "lounge",
                "dining", "sitting", "museum", "solarium", "pool", "balcony",
                "mezzanine", "atrium", "reception", "entrance", "foyer", "snack",
                "bowling", "round room", "windsor"]),
    ("delivery", ["office", "bedroom", "suite", "room", "unit", "apartment", "studio",
                  "den", "study", "chamber", "ward", "cabin", "dressing"]),
]

# What the robot may do with each category.
_POLICY = {
    "delivery":   {"deliverable": True,  "walkable": True,  "type": "unit"},
    "common":     {"deliverable": True,  "walkable": True,  "type": "lobby"},
    "service":    {"deliverable": True,  "walkable": True,  "type": "unit"},
    "charging":   {"deliverable": False, "walkable": True,  "type": "charging"},
    "restricted": {"deliverable": False, "walkable": False, "type": "restricted"},
    "unknown":    {"deliverable": True,  "walkable": True,  "type": "unit"},
}


def classify_room(label):
    """Classify a room label into a category and return its robot policy.

    Returns a dict: {category, deliverable, walkable, type}. Unknown labels
    default to a deliverable unit so nothing useful is silently dropped.
    """
    text = (label or "").lower()
    for category, keywords in _RULES:
        if any(kw in text for kw in keywords):
            return {"category": category, **_POLICY[category]}
    return {"category": "unknown", **_POLICY["unknown"]}


def enrich_pois(pois):
    """Attach a semantic category + policy to each OCR'd POI, set its delivery
    `type` from its meaning (charging rooms become charging POIs), and drop
    restricted spaces (voids, shafts, elevators, mechanical rooms) so they are
    never offered as delivery destinations. Returns the filtered list."""
    out = []
    for p in pois:
        info = classify_room(p.get("label", ""))
        p["category"] = info["category"]
        p["deliverable"] = info["deliverable"]
        if info["category"] == "restricted":
            continue  # not a place the robot delivers to
        # promote a detected charging room to a charging POI automatically
        if info["type"] == "charging":
            p["type"] = "charging"
        out.append(p)
    return out


if __name__ == "__main__":  # tiny self-check
    for name in ["Sir Henry Pellatt's Bedroom", "Wine Cellar", "Elevator",
                 "Charging Dock", "Lobby", "Office A", "Furnace Room"]:
        print(f"{name:34s} -> {classify_room(name)}")
