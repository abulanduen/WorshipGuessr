import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These do filesystem-relative binary/path lookups (via __dirname) at
  // require-time, which breaks if the bundler rewrites module paths — keep
  // them as real, unbundled `require()`s in the server runtime.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "fluent-ffmpeg", "music-metadata"],
};

export default nextConfig;
