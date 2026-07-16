import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@werehere/contracts", "@werehere/ui"],
};

export default nextConfig;
