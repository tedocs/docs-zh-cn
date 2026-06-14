const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '..', 'docs', 'sync-workflow.svg');
const outputPath = path.resolve(__dirname, '..', 'docs', 'sync-workflow.png');

const { Resvg } = require('@resvg/resvg-js');
const svg = readFileSync(inputPath, 'utf-8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1800 }
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
writeFileSync(outputPath, pngBuffer);
console.log('OK: docs/sync-workflow.png (' + pngBuffer.length + ' bytes)');
