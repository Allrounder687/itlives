import type { NextConfig } from "next";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  output: "export",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@tauri-apps/api"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node": false,
      "fs": false,
      "path": false,
      "crypto": false,
    };
    return config;
  },
};

export default nextConfig;
