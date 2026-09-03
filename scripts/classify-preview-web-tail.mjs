import { readFileSync, statSync } from "node:fs";

const inputPath = process.argv[2];
const maxBytes = 10 * 1024 * 1024;
const settingsPathPattern =
  /^https:\/\/[^/]+\/hotels\/[^/?#]+\/inspections\/settings(?:[?#].*)?$/u;

const classifications = [
  ["CRYPTO_RANDOM_UUID", /crypto\.randomUUID/iu],
  ["SUBREQUEST_LIMIT", /too many subrequests|subrequest (?:depth )?limit/iu],
  ["NO_RESPONSE", /script will never generate a response/iu],
  ["CPU_LIMIT", /CPU time limit|exceeded CPU/iu],
  ["MEMORY_LIMIT", /memory limit|exceeded memory/iu],
  ["TYPE_ERROR", /"name":"TypeError"/u],
  ["RANGE_ERROR", /"name":"RangeError"/u],
  ["ERROR", /"name":"Error"/u],
];

function isSettingsEvent(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.event !== null &&
    typeof value.event === "object" &&
    value.event.request !== null &&
    typeof value.event.request === "object" &&
    typeof value.event.request.url === "string" &&
    settingsPathPattern.test(value.event.request.url)
  );
}

function parseJsonObjectStream(content) {
  const values = [];
  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== "{" && content[start] !== "[") continue;
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let cursor = start; cursor < content.length; cursor += 1) {
      const character = content[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === "{" || character === "[") stack.push(character);
      else if (character === "}" || character === "]") {
        const opening = stack.pop();
        if (
          (character === "}" && opening !== "{") ||
          (character === "]" && opening !== "[")
        )
          break;
        if (stack.length === 0) {
          try {
            values.push(JSON.parse(content.slice(start, cursor + 1)));
            start = cursor;
          } catch {
            // Skip malformed or non-JSON Wrangler control output.
          }
          break;
        }
      }
    }
  }
  return values;
}

function classify() {
  if (!inputPath) return "INPUT_INVALID";
  try {
    const metadata = statSync(inputPath);
    if (!metadata.isFile() || metadata.size > maxBytes) return "INPUT_INVALID";
    if ((metadata.mode & 0o077) !== 0) return "INPUT_UNSAFE_MODE";
    const events = parseJsonObjectStream(readFileSync(inputPath, "utf8")).filter(
      isSettingsEvent,
    );
    if (events.length === 0) return "NO_SETTINGS_EVENT";
    if (events.some((event) => event.outcome === "exceededCpu"))
      return "CPU_LIMIT";
    if (events.some((event) => event.outcome === "exceededMemory"))
      return "MEMORY_LIMIT";
    const privateEventData = events.map((event) => JSON.stringify(event)).join("\n");
    for (const [marker, pattern] of classifications) {
      if (pattern.test(privateEventData)) return marker;
    }
    return "SETTINGS_EVENT_UNCLASSIFIED";
  } catch {
    return "INPUT_INVALID";
  }
}

process.stdout.write(`PREVIEW_WEB_SSR_TAIL_${classify()}\n`);
