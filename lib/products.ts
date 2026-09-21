export const PRODUCTS = [
  { key: "NAVIGATION", label: "Clonify Indoor Navigation", description: "Accessible routes, voice guidance, and live indoor help." },
  { key: "SHOWCASE", label: "Clonify Indoor Showcase", description: "Photographer-free virtual home and property tours." },
  { key: "RENOVATION", label: "Clonify Indoor Renovation", description: "Progress capture, issue pins, measurements, and renovation plans." },
  { key: "ROBOTICS", label: "Clonify Indoor Robotics", description: "Confidential multi-floor fleet navigation for approved pilots." },
] as const;

export type ProductKey = (typeof PRODUCTS)[number]["key"];
export const ADMIN_EMAIL = "mail@clonify.ca";
