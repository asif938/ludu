import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is a real-time, highly dynamic app (room/game state), so we keep
  // classic dynamic rendering rather than opting into cache-components.
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
