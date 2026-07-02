import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone-сборка для лёгкого docker-образа.
  output: "standalone",
};

export default nextConfig;
