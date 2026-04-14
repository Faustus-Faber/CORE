import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const OPEN1 = String.fromCharCode(60, 116, 104, 105, 110, 107, 105, 110, 103, 62);
const CLOSE1 = String.fromCharCode(60, 47, 116, 104, 105, 110, 107, 105, 110, 103, 62);
const OPEN2 = String.fromCharCode(60, 116, 104, 105, 110, 107, 62);
const CLOSE2 = String.fromCharCode(60, 47, 116, 104, 105, 110, 107, 62);

async function clean() {
  const events = await prisma.crisisEvent.findMany({
    where: {
      sitRepText: { contains: String.fromCharCode(60, 116, 104, 105, 110, 107) }
    }
  });

  console.log("Found " + events.length + " events with thinking tags");

  for (const event of events) {
    if (!event.sitRepText) continue;
    const cleaned = stripThinkingTags(event.sitRepText);
    await prisma.crisisEvent.update({
      where: { id: event.id },
      data: { sitRepText: cleaned }
    });
    console.log("Cleaned: " + event.title.slice(0, 50) + "...");
  }

  console.log("Done");
  process.exit(0);
}

function stripThinkingTags(text: string): string {
  let result = text;
  for (let i = 0; i < 10; i++) {
    let changed = false;
    const patterns: [string, string][] = [
      [OPEN1, CLOSE1],
      [OPEN2, CLOSE2],
      [OPEN1, CLOSE2],
      [OPEN2, CLOSE1],
    ];
    for (const [open, close] of patterns) {
      const startIdx = result.indexOf(open);
      if (startIdx !== -1) {
        let closeIdx = result.indexOf(close, startIdx + open.length);
        if (closeIdx !== -1) {
          result = result.slice(0, startIdx) + result.slice(closeIdx + close.length);
          changed = true;
        } else {
          result = result.slice(0, startIdx);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return result.trim();
}

clean();
