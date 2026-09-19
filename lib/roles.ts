export const ROLES = [
  "REAL_ESTATE",
  "DISASTER_RELIEF",
  "ACCESSIBILITY_AUDIT",
  "MEP_ENGINEER",
] as const;

export type RoleKey = (typeof ROLES)[number];

export const ROLE_INFO: Record<
  RoleKey,
  {
    label: string;
    tagline: string;
    sdg: string;
    sdgTitle: string;
    color: string;
  }
> = {
  REAL_ESTATE: {
    label: "Real Estate Agent / Stager",
    tagline: "Virtual spatial staging & remote buyer tours.",
    sdg: "SDG 12",
    sdgTitle: "Zero-emissions staging & digital furniture inspection.",
    color: "from-emerald-500 to-teal-600",
  },
  DISASTER_RELIEF: {
    label: "Disaster Relief / Insurance Adjuster",
    tagline: "Rapid structural damage assessment & emergency claims.",
    sdg: "SDG 11",
    sdgTitle: "Accelerated post-disaster housing inspection & funding.",
    color: "from-orange-500 to-red-600",
  },
  ACCESSIBILITY_AUDIT: {
    label: "Municipal / Accessibility Auditor",
    tagline: "ADA & global accessibility compliance checks.",
    sdg: "SDG 10",
    sdgTitle: "Democratized urban accessibility mapping for equal mobility.",
    color: "from-blue-500 to-indigo-600",
  },
  MEP_ENGINEER: {
    label: "Renovation Contractor / MEP Engineer",
    tagline: "Energy efficiency retrofits & infrastructure upgrades.",
    sdg: "SDG 9",
    sdgTitle: "Cost-effective green retrofitting for aging infrastructure.",
    color: "from-violet-500 to-purple-600",
  },
};

export const PROCESSING_LOGS: Record<RoleKey, string[]> = {
  REAL_ESTATE: [
    "Extracting camera poses...",
    "Running MapLibre/IMDF floor mesh alignment...",
    "Generating staging-ready spatial telemetry...",
    "Rendering high-res listing views...",
  ],
  DISASTER_RELIEF: [
    "Extracting camera poses...",
    "Computing volumetric mesh displacement...",
    "Flagging structural hazard zones...",
    "Compiling emergency relief summary...",
  ],
  ACCESSIBILITY_AUDIT: [
    "Extracting camera poses...",
    "Running MapLibre/IMDF floor mesh alignment...",
    "Measuring ramp slopes & doorway clearances...",
    "Scoring ADA compliance...",
  ],
  MEP_ENGINEER: [
    "Extracting camera poses...",
    "Aligning IMDF blueprint overlay...",
    "Mapping duct/conduit clearance zones...",
    "Generating retrofit heatmap...",
  ],
};
