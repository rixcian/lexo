import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs `server.js` from the traced standalone bundle.
  output: "standalone",

  // better-sqlite3 is a native addon - it must stay outside the bundler.
  serverExternalPackages: ["better-sqlite3"],

  experimental: {
    serverActions: {
      // .apkg decks routinely run to tens of megabytes.
      bodySizeLimit: "64mb",
    },
  },

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
