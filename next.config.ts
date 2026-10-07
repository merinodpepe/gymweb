import type { NextConfig } from "next";

// Personal dashboard: every page reads the session cookie and the database at
// request time, so Cache Components / partial prefetching are not used.
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
