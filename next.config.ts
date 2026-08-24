import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js loads a platform-specific native binary, which the bundler
  // cannot trace. Keep it external so it is required at runtime instead.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
