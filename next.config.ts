import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs `server.js` from the traced standalone bundle.
  output: "standalone",

  // better-sqlite3 is a native addon - it must stay outside the bundler.
  serverExternalPackages: ["better-sqlite3"],

  // The floating dev badge overlaps the bottom-left of the UI; the error
  // overlay still works without it.
  devIndicators: false,

  experimental: {
    serverActions: {
      // Covers the images and audio attached to a single card. Deck files do
      // not come through an action: `next build` freezes this value into the
      // standalone bundle, so it could never be re-tuned from the environment.
      // That is why /api/import is a route handler reading ANKI_MAX_UPLOAD_MB.
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
