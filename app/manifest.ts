import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clonify · Spatial intelligence for every room",
    short_name: "Clonify",
    description: "Navigate, showcase, and renovate from one metric digital twin.",
    start_url: "/",
    display: "standalone",
    background_color: "#060c07",
    theme_color: "#060c07",
    orientation: "portrait-primary",
    icons: [{ src: "/logo.png", sizes: "192x192", type: "image/png" }, { src: "/logo.png", sizes: "512x512", type: "image/png" }],
  };
}
