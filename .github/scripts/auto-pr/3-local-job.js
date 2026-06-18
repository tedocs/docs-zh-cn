import { execFileSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const BASE = ".github/scripts/auto-pr";

/**
 * Tip: 当 json 减少时候，作为一个文件，翻译，翻译任务多时候，使用 item 模式去翻译，这样更精准，因为 json 过大会导致质量差
 * Mode: "all" = one call for everything, "file" = one call per file, "item" = one call per item
 */
const MODE = process.env.TRANSLATE_MODE || "all";

// Load todo list from merge job
const todo = JSON.parse(readFileSync(`${BASE}/todo-translation.json`, "utf-8"));

if (todo.length === 0) {
  console.log("No items to translate.");
  process.exit(0);
}

console.log(`Mode: ${MODE}`);

// Load prompt template and translation conventions (once)
const promptTemplate = readFileSync(`${BASE}/translation-prompt.md`, "utf-8");
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

const basePrompt = promptTemplate
  .replace("{{TERMINOLOGY}}", terminology)
  .replace("{{FORMATTING}}", formatting)
  .replace("{{GUIDELINES}}", guidelines);

// Separate items that need translation from those already identical
const toTranslate = [];
const identical = [];
for (const item of todo) {
  if (item.incoming === item.current) {
    identical.push(item);
  } else {
    toTranslate.push(item);
  }
}

console.time("Translation_times");

console.log(
  `Total: ${todo.length}, toTranslate: ${toTranslate.length}, identical: ${identical.length}`,
);

const done = [];
let translated = 0;
let skipped = 0;

// Identical items always skip
for (const item of identical) {
  skipped++;
  done.push({ ...item, review: item.current });
}

function callClaude(items) {
  const itemsJson = JSON.stringify(items, null, 2);
  const prompt = basePrompt.replace("{{ITEMS}}", itemsJson);

  const result = execFileSync("claude", ["-p", "--output-format", "json", "--allowedTools", ""], {
    input: prompt,
    encoding: "utf-8",
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 300_000,
  }).trim();

  // Claude returns { "result": "...", "cost_usd": ... }

  const parsed = JSON.parse(result);
  const text = typeof parsed === "string" ? parsed : parsed.result;

  const jsonStr = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  const reviewed = JSON.parse(jsonStr);

  if (!Array.isArray(reviewed) || reviewed.length !== items.length) {
    throw new Error(
      `Expected array of ${items.length}, got ${Array.isArray(reviewed) ? reviewed.length : typeof reviewed}`,
    );
  }

  return reviewed;
}

function fallbackIncoming(items) {
  for (const item of items) {
    skipped++;
    done.push({ ...item, review: item.incoming });
  }
}

if (toTranslate.length > 0) {
  if (MODE === "all") {
    try {
      const reviewed = callClaude(toTranslate);
      for (const item of reviewed) {
        translated++;
        done.push(item);
      }
      console.log(`✓ ${translated} items translated in 1 call`);
    } catch (err) {
      console.error(`✗ batch failed: ${err.message}, falling back`);
      fallbackIncoming(toTranslate);
    }
  } else if (MODE === "file") {
    const byFileTranslate = {};
    for (const item of toTranslate) {
      (byFileTranslate[item.file] ??= []).push(item);
    }

    for (const [file, items] of Object.entries(byFileTranslate)) {
      console.log(`\n📄 ${file} (${items.length} items)`);
      try {
        const reviewed = callClaude(items);
        for (const item of reviewed) {
          translated++;
          done.push(item);
          console.log(`  lines ${item.lines.join("-")} ✓`);
        }
      } catch (err) {
        console.error(`  ✗ failed: ${err.message}, falling back`);
        fallbackIncoming(items);
      }
    }
  } else {
    for (const item of toTranslate) {
      console.log(`  lines ${item.lines.join("-")}`);
      try {
        const reviewed = callClaude([item]);
        translated++;
        done.push(reviewed[0]);
        console.log(`    ✓ translated`);
      } catch (err) {
        console.error(`    ✗ failed: ${err.message}`);
        skipped++;
        done.push({ ...item, review: item.incoming });
      }
    }
  }
}

writeFileSync(`${BASE}/done-translation.json`, JSON.stringify(done, null, 2), "utf-8");

console.log(
  `\n✅ Done: ${translated} translated, ${skipped} skipped → ${BASE}/done-translation.json`,
);

console.timeEnd("Translation_times");
