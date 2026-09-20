import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The local app is commonly opened as 127.0.0.1 while Next reports
  // localhost. Allow both names so HMR and same-origin API calls work.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
