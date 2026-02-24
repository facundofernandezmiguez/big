import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Using default Turbopack settings which should handle WASM automatically
};

export default nextConfig;
