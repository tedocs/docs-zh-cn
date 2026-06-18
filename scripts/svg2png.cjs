const { readFileSync, writeFileSync } = require("fs");
const path = require("path");

const inputPath = path.resolve(
  __dirname,
  "..",
  ".github",
  "scripts",
  "auto-pr",
  "compare-sync-arch.svg",
);
const outputPath = path.resolve(
  __dirname,
  "..",
  ".github",
  "scripts",
  "auto-pr",
  "compare-sync-arch.png",
);

const { Resvg } = require("@resvg/resvg-js");
const svg = readFileSync(inputPath, "utf-8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1800 },
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
writeFileSync(outputPath, pngBuffer);
console.log(`OK: ${outputPath} (${pngBuffer.length} bytes)`);
