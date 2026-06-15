import { execFileSync } from "child_process";

// Prompt with shell metacharacters that would break execSync
const prompt = `Translate to Chinese. Return ONLY the translated text.

## Rules
- Use > for blockquotes
- Keep \`code\` as-is
- Tables: | a | b |
- HTML: <div>test</div>

## Text
The \`ref()\` function creates a reactive reference. Use <template> for slots.
> **Note**: This is important.`;

console.log("Testing execFileSync with metacharacters...");
console.log("Prompt length:", prompt.length);

try {
  const result = execFileSync("copilot", ["-p", prompt, "--allow-all", "-s"], {
    encoding: "utf-8",
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 120_000,
  }).trim();

  console.log("Result:", result);
  console.log("\n✅ execFileSync works correctly!");
} catch (err) {
  console.error("Failed:", err.message);
  if (err.stderr) console.error("stderr:", err.stderr);
  process.exit(1);
}
