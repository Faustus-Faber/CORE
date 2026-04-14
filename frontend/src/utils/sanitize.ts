const TAG_PAIRS: [string, string][] = [
  ["<thinking>", "</thinking>"],
  ["<think>", "</think>"],
  ["<thinking>", "</think>"],
  ["<think>", "</thinking>"]
];

const MAX_STRIP_PASSES = 10;

export function stripThinkingTags(text: string): string {
  let result = text;

  for (let pass = 0; pass < MAX_STRIP_PASSES; pass++) {
    let changed = false;

    for (const [openTag, closeTag] of TAG_PAIRS) {
      const openIndex = result.indexOf(openTag);
      if (openIndex === -1) continue;

      const closeIndex = result.indexOf(closeTag, openIndex + openTag.length);
      if (closeIndex !== -1) {
        result = result.slice(0, openIndex) + result.slice(closeIndex + closeTag.length);
      } else {
        result = result.slice(0, openIndex);
      }
      changed = true;
    }

    if (!changed) break;
  }

  return result.trim();
}
