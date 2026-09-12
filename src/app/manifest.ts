import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "lexo - spaced repetition",
    short_name: "lexo",
    description:
      "A self-hosted flashcard app with FSRS scheduling, deck import and study stats.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // DESIGN.md section 2: paper-white canvas, Feather Green brand.
    background_color: "#ffffff",
    theme_color: "#58cc02",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Stats", url: "/stats" },
      { name: "Import a deck", url: "/import" },
    ],
  };
}
