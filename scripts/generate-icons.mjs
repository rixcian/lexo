import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.join(process.cwd(), "public", "icons");
const source = await fs.readFile(path.join(root, "icon.svg"));

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "maskable-512.png", size: 512, padding: 0.1 },
];

for (const target of targets) {
  const inner = Math.round(target.size * (1 - (target.padding ?? 0) * 2));
  const pad = Math.round((target.size - inner) / 2);

  await sharp(source, { density: 384 })
    .resize(inner, inner)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: "#58cc02",
    })
    .png()
    .toFile(path.join(root, target.name));

  console.log("wrote", target.name);
}
