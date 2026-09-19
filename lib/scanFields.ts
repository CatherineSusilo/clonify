import type { RoleKey } from "./roles";

export type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "select" | "number";
  options?: string[];
};

export const ROLE_SCAN_FIELDS: Record<RoleKey, FieldConfig[]> = {
  REAL_ESTATE: [
    { name: "roomType", label: "Room Type", type: "select", options: ["Living Room", "Bedroom", "Kitchen", "Bathroom"] },
    { name: "wallColorHex", label: "Target Wall Color (HEX)", type: "text" },
    { name: "flooring", label: "Flooring Material", type: "select", options: ["Hardwood", "Marble", "Carpet", "Tile"] },
    { name: "listingPrice", label: "Listing Price", type: "number" },
    { name: "targetStyle", label: "Target Style", type: "select", options: ["Modern", "Minimalist", "Traditional", "Industrial"] },
  ],
  DISASTER_RELIEF: [
    { name: "eventType", label: "Event Type", type: "select", options: ["Earthquake", "Flood", "Storm", "Fire"] },
    { name: "severityIndex", label: "Event Severity Index (1-10)", type: "number" },
    { name: "policyId", label: "Policy ID", type: "text" },
    { name: "hazardNotes", label: "Structural Hazard Notes", type: "text" },
  ],
  ACCESSIBILITY_AUDIT: [
    { name: "buildingType", label: "Building Type", type: "select", options: ["Public Transit", "Sidewalk", "School", "Government Building"] },
    { name: "mobilityStandard", label: "Mobility Standard Preset", type: "select", options: ["ADA (US)", "EN 301 549 (EU)", "AODA (Canada)"] },
  ],
  MEP_ENGINEER: [
    { name: "equipmentType", label: "Equipment Type", type: "select", options: ["HVAC", "Solar", "Piping", "Electrical"] },
    { name: "clearanceTolerance", label: "Clearance Tolerance (in)", type: "number" },
  ],
};
