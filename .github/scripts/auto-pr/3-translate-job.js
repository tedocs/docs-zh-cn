import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const BASE = ".github/scripts/auto-pr";

// Load todo list from merge job
const todo = JSON.parse(readFileSync(`${BASE}/todo-translation.json`, "utf-8"));

if (todo.length === 0) {
  console.log("No items to translate.");
  process.exit(0);
}

// Load translation conventions
const terminology = readFileSync(
  ".claude/skills/vuejs-docs-zh-cn/references/terminology.md",
  "utf-8",
);
const formatting = readFileSync(
  ".claude/skills/vuejs-docs-zh-cn/references/formatting.md",
  "utf-8",
);
const guidelines = readFileSync(
  ".claude/skills/vuejs-docs-zh-cn/references/guidelines.md",
  "utf-8",
);

// Group items by file
const byFile = {};
for (const item of todo) {
  (byFile[item.file] ??= []).push(item);
}

const done = [];
let translated = 0;
let skipped = 0;

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n📄 ${file} (${items.length} items)`);

  for (const [i, item] of items.entries()) {
    console.log(`  [${i + 1}/${items.length}] lines ${item.lines.join("-")}`);

    // If incoming is same as current (Chinese), no translation needed
    if (item.incoming === item.current) {
      console.log("    ⏭ same as current, skip");
      skipped++;
      done.push({ ...item, review: item.current });
      continue;
    }

    const prompt = `You are a Vue.js documentation translator (English → Simplified Chinese).

## Terminology
${terminology}

## Formatting Rules
${formatting}

## Guidelines
${guidelines}

## Task
Translate the "incoming" text below into Simplified Chinese. Use the "current" text as reference for style and tone. Return ONLY the translated text, no explanations.

## Current (Chinese reference)
${item.current}

## Incoming (to translate)
${item.incoming}`;

    try {
      const result = execSync(`copilot -p ${JSON.stringify(prompt)} --allow-all -s`, {
        encoding: "utf-8",
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120_000,
      }).trim();

      if (result) {
        done.push({ ...item, review: result });
        translated++;
        console.log("    ✓ translated");
      } else {
        console.log("    ⚠ empty result, keeping incoming");
        done.push({ ...item, review: item.incoming });
        skipped++;
      }
    } catch (err) {
      console.error(`    ✗ copilot failed: ${err.message}`);
      done.push({ ...item, review: item.incoming });
      skipped++;
    }
  }
}

writeFileSync(`${BASE}/done-translation.json`, JSON.stringify(done, null, 2), "utf-8");

console.log(
  `\n✅ Done: ${translated} translated, ${skipped} skipped → ${BASE}/done-translation.json`,
);
