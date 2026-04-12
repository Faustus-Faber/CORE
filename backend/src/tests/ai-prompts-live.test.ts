import { describe, it, expect } from "vitest";
import "dotenv/config";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_QWEN_MODEL = process.env.GROQ_QWEN_MODEL ?? "qwen/qwen3-32b";
const TIMEOUT_MS = 25000;

const skipReason = !GROQ_API_KEY || GROQ_API_KEY === "test-groq-key"
  ? "GROQ_API_KEY not configured — set it in .env to run live AI tests"
  : undefined;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function groqChat(
  systemPrompt: string,
  userPrompt: string,
  attempt = 0
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_QWEN_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      }),
      signal: controller.signal
    });

    if (res.status === 429 && attempt < 4) {
      clearTimeout(timer);
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const backoffMs = Math.max(retryAfter * 1000, 3000 * (attempt + 1));
      await sleep(backoffMs);
      return groqChat(systemPrompt, userPrompt, attempt + 1);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Groq ${res.status}: ${body}`);
    }

    const payload = await res.json();
    await sleep(1500);
    return payload.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// ─── IMPROVED PROMPTS ──────────────────────────────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = [
  "You are an emergency incident classification engine for a crisis response platform in Bangladesh.",
  "",
  "Analyze the user-submitted report below and return ONLY a JSON object with these exact keys:",
  "",
  '  "credibility_score": integer 0-100 — how credible/genuine this report is.',
  '  "severity_level": one of "CRITICAL", "HIGH", "MEDIUM", "LOW".',
  '  "incident_type": one of "FLOOD", "FIRE", "EARTHQUAKE", "BUILDING_COLLAPSE", "ROAD_ACCIDENT", "VIOLENCE", "MEDICAL_EMERGENCY", "OTHER".',
  '  "incident_title": a concise 5-12 word title summarizing the incident. Never include GPS coordinates in this title.',
  '  "spam_flagged": boolean — true only if the report is spam, nonsense, a test, or contains a deliberate location mismatch.',
  "",
  "Severity guidelines:",
  '  CRITICAL — immediate life threat, mass casualties, large-scale destruction, or rapidly worsening situation.',
  '  HIGH — significant danger to people or property, injuries reported, urgent response needed.',
  '  MEDIUM — localized damage or disruption, no immediate life threat but needs attention.',
  '  LOW — minor incident, informational, or situation is already under control.',
  "",
  "Credibility rules:",
  "  80-100: specific location, clear description, consistent details, matches known crisis patterns.",
  "  50-79: some details present but vague, or unverifiable.",
  "  20-49: very vague, inconsistent, or suspicious but not clearly fake.",
  "  0-19: clearly spam, nonsense, test message, or deliberate fraud.",
  "",
  "GPS location mismatch detection:",
  "  When GPS coordinates are provided alongside the report text, verify that any location names mentioned in the text are geographically consistent with those coordinates.",
  "  Use your knowledge of Bangladesh geography (Dhaka districts: Mirpur ~23.81/90.37, Dhanmondi ~23.74/90.38, Uttara ~23.87/90.40, Gulshan ~23.79/90.42, Motijheel ~23.73/90.42; divisional cities: Chittagong ~22.34/91.83, Sylhet ~24.89/91.87, Rajshahi ~24.37/88.60, Khulna ~22.82/89.54).",
  '  If the text names a specific location that is more than 15km away from the provided GPS coordinates, set credibility_score to 0 and spam_flagged to true.',
  "",
  "Return raw JSON only. No markdown fences, no explanation, no extra keys."
].join("\n");

const SIMILARITY_SYSTEM_PROMPT = [
  "You are a duplicate-incident detection engine for a crisis response platform.",
  "",
  "You will receive two emergency incident reports (Report A and Report B). Determine whether they describe the SAME real-world incident.",
  "",
  'Return ONLY a JSON object: {"similarity_score": <number>}',
  "",
  "Scoring rules:",
  "  1.0  — certainly the same incident (same event, same location, same timeframe).",
  "  0.8-0.99 — very likely the same incident described differently.",
  "  0.5-0.79 — possibly related (same area and type, but could be separate events).",
  "  0.2-0.49 — weakly related (same general type but clearly different events).",
  "  0.0-0.19 — completely unrelated incidents.",
  "",
  "Key factors to consider:",
  "  - Geographic proximity: incidents at the same location or within 1-2km are more likely duplicates.",
  "  - Incident type match: a flood report and another flood report in the same area are likely duplicates.",
  "  - Temporal cues: references to the same time/date increase similarity.",
  "  - Distinct details: different casualty counts, different buildings, or different streets lower similarity.",
  "",
  "Return raw JSON only. No markdown, no explanation."
].join("\n");

const ADVISORY_SYSTEM_PROMPT = [
  "You are a public safety advisor for a community crisis dashboard in Bangladesh.",
  "",
  "Based on the active incidents and available resources provided, generate actionable safety advisories for community members.",
  "",
  'Return ONLY a JSON object: {"advisories": ["...", "...", ...]}',
  "",
  "Rules:",
  "  - Generate exactly 5 to 7 advisory strings.",
  "  - Each advisory must be 1 sentence, under 25 words, and directly actionable.",
  "  - Tailor advisories to the specific incident types present (e.g., flood → move to higher ground; fire → avoid smoke inhalation).",
  "  - If resources are available, mention them (e.g., 'Medical supplies available at Mirpur-10 relief center').",
  "  - Include at least one general safety advisory (e.g., 'Keep emergency contacts accessible').",
  "  - Do not repeat the same advice in different words.",
  "",
  "Return raw JSON only. No markdown, no explanation."
].join("\n");

// ─── TEST SUITE 1: Incident Classification ─────────────────────────────────────

describe.skipIf(skipReason)("AI Prompt: Incident Classification", () => {
  it("classifies a genuine flood report correctly", async () => {
    const userContent = [
      "Location coordinates: 23.8100, 90.4125",
      "",
      "Heavy flooding in Mirpur area after continuous rainfall since morning.",
      "Water level rising rapidly, several streets submerged. Many families trapped in ground floor apartments.",
      "Local volunteers trying to evacuate but need boats urgently."
    ].join("\n");

    const raw = await groqChat(CLASSIFIER_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.credibility_score).toBeGreaterThanOrEqual(60);
    expect(result.spam_flagged).toBe(false);
    expect(result.severity_level).toMatch(/^(CRITICAL|HIGH)$/);
    expect(result.incident_type).toBe("FLOOD");
    expect(result.incident_title).toBeTruthy();
    expect(result.incident_title).not.toMatch(/23\.\d+/);
  }, TIMEOUT_MS);

  it("classifies a fire incident with correct severity", async () => {
    const userContent = [
      "Location coordinates: 23.7465, 90.3762",
      "",
      "Major fire broke out in a garment factory in Dhanmondi area.",
      "Multiple floors engulfed in flames. Fire service has been called.",
      "At least 15 workers reported trapped inside. Thick black smoke visible from far."
    ].join("\n");

    const raw = await groqChat(CLASSIFIER_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.credibility_score).toBeGreaterThanOrEqual(65);
    expect(result.spam_flagged).toBe(false);
    expect(result.severity_level).toBe("CRITICAL");
    expect(result.incident_type).toBe("FIRE");
  }, TIMEOUT_MS);

  it("classifies a minor road accident as LOW/MEDIUM", async () => {
    const userContent = [
      "Small fender bender near Farmgate intersection.",
      "Two cars bumped, no injuries. Traffic is slightly slow but moving.",
      "Police arrived and handling it."
    ].join("\n");

    const raw = await groqChat(CLASSIFIER_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.severity_level).toMatch(/^(LOW|MEDIUM)$/);
    expect(result.incident_type).toBe("ROAD_ACCIDENT");
    expect(result.spam_flagged).toBe(false);
  }, TIMEOUT_MS);

  it("flags spam/test reports", async () => {
    const userContent = "test test test just checking if this works hello world 123";

    const raw = await groqChat(CLASSIFIER_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.spam_flagged).toBe(true);
    expect(result.credibility_score).toBeLessThan(30);
  }, TIMEOUT_MS);

  it("flags GPS location mismatch as fraud", async () => {
    const userContent = [
      "Location coordinates: 22.3400, 91.8300",
      "",
      "Severe flooding in Mirpur, Dhaka. Water everywhere, people stuck on rooftops.",
      "Need rescue immediately."
    ].join("\n");

    const raw = await groqChat(CLASSIFIER_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.spam_flagged).toBe(true);
    expect(result.credibility_score).toBeLessThanOrEqual(10);
  }, TIMEOUT_MS);

  it("returns valid JSON with all required keys", async () => {
    const userContent = "Building collapsed near Motijheel commercial area. Dust cloud rising. People screaming for help.";

    const raw = await groqChat(CLASSIFIER_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result).toHaveProperty("credibility_score");
    expect(result).toHaveProperty("severity_level");
    expect(result).toHaveProperty("incident_type");
    expect(result).toHaveProperty("incident_title");
    expect(result).toHaveProperty("spam_flagged");
    expect(typeof result.credibility_score).toBe("number");
    expect(typeof result.severity_level).toBe("string");
    expect(typeof result.incident_type).toBe("string");
    expect(typeof result.incident_title).toBe("string");
    expect(typeof result.spam_flagged).toBe("boolean");
    expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(result.severity_level);
    expect([
      "FLOOD", "FIRE", "EARTHQUAKE", "BUILDING_COLLAPSE",
      "ROAD_ACCIDENT", "VIOLENCE", "MEDICAL_EMERGENCY", "OTHER"
    ]).toContain(result.incident_type);
  }, TIMEOUT_MS);

  it("handles Bangla-translated text correctly", async () => {
    const userContent = [
      "Location coordinates: 24.8900, 91.8700",
      "",
      "There is heavy flood in Sylhet city. The Surma river has overflowed.",
      "Many houses under water. People are moving to shelters.",
      "Food and clean water needed urgently."
    ].join("\n");

    const raw = await groqChat(CLASSIFIER_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.credibility_score).toBeGreaterThanOrEqual(60);
    expect(result.spam_flagged).toBe(false);
    expect(result.incident_type).toBe("FLOOD");
    expect(result.severity_level).toMatch(/^(CRITICAL|HIGH)$/);
  }, TIMEOUT_MS);
});

// ─── TEST SUITE 2: Duplicate Clustering / Similarity ────────────────────────────

describe.skipIf(skipReason)("AI Prompt: Similarity Scoring", () => {
  it("scores identical incidents close to 1.0", async () => {
    const userContent = [
      "Report A: Heavy flooding in Mirpur-10 after morning rainfall. Water level 3 feet on roads. Families trapped in ground floor. Location: Mirpur, Dhaka.",
      "",
      "Report B: Mirpur-10 area severely flooded since this morning. Streets under 3 feet of water. Residents stuck in homes. Location: Mirpur, Dhaka.",
      "",
      'Return JSON: {"similarity_score": <number>}'
    ].join("\n");

    const raw = await groqChat(SIMILARITY_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.similarity_score).toBeGreaterThanOrEqual(0.8);
  }, TIMEOUT_MS);

  it("scores different incidents close to 0.0", async () => {
    const userContent = [
      "Report A: Fire in garment factory in Dhanmondi. 15 workers trapped. Fire service on the way.",
      "",
      "Report B: Road accident on Dhaka-Chittagong highway near Comilla. Bus overturned, 20 passengers injured.",
      "",
      'Return JSON: {"similarity_score": <number>}'
    ].join("\n");

    const raw = await groqChat(SIMILARITY_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.similarity_score).toBeLessThan(0.3);
  }, TIMEOUT_MS);

  it("scores related-but-distinct incidents in the middle range", async () => {
    const userContent = [
      "Report A: Flood in Mirpur-10, Dhaka. Water entering homes. Families evacuating to rooftops.",
      "",
      "Report B: Flood in Mirpur-12, Dhaka. Roads waterlogged but no residential damage yet. Drains overflowing.",
      "",
      'Return JSON: {"similarity_score": <number>}'
    ].join("\n");

    const raw = await groqChat(SIMILARITY_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.similarity_score).toBeGreaterThanOrEqual(0.4);
    expect(result.similarity_score).toBeLessThan(0.85);
  }, TIMEOUT_MS);

  it("returns valid JSON with similarity_score key", async () => {
    const userContent = [
      "Report A: Earthquake tremor felt in Dhaka at 3pm. Buildings shook for 10 seconds.",
      "",
      "Report B: Earthquake felt in Dhaka around 3pm. Slight tremor lasting about 10 seconds. No damage reported.",
      "",
      'Return JSON: {"similarity_score": <number>}'
    ].join("\n");

    const raw = await groqChat(SIMILARITY_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result).toHaveProperty("similarity_score");
    expect(typeof result.similarity_score).toBe("number");
    expect(result.similarity_score).toBeGreaterThanOrEqual(0);
    expect(result.similarity_score).toBeLessThanOrEqual(1);
  }, TIMEOUT_MS);
});

// ─── TEST SUITE 3: Safety Advisories ────────────────────────────────────────────

describe.skipIf(skipReason)("AI Prompt: Safety Advisories", () => {
  it("generates 5-7 advisories for flood scenario", async () => {
    const userContent = [
      "Active incidents: Severe flood in Mirpur-10 (CRITICAL, FLOOD) at Mirpur, Dhaka - Water level rising; Moderate flood in Uttara (MEDIUM, FLOOD) at Uttara Sector-7 - Waterlogging on streets.",
      "Available resources: Drinking Water: 500 bottles at Mirpur Relief Camp; First Aid Kits: 50 units at Uttara Community Center.",
      "Generate 5-7 concise safety advisories for the community."
    ].join(" ");

    const raw = await groqChat(ADVISORY_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result).toHaveProperty("advisories");
    expect(Array.isArray(result.advisories)).toBe(true);
    expect(result.advisories.length).toBeGreaterThanOrEqual(5);
    expect(result.advisories.length).toBeLessThanOrEqual(7);
    for (const advisory of result.advisories) {
      expect(typeof advisory).toBe("string");
      expect(advisory.length).toBeGreaterThan(10);
    }
  }, TIMEOUT_MS);

  it("generates advisories for mixed incident types", async () => {
    const userContent = [
      "Active incidents: Fire at Dhanmondi garment factory (CRITICAL, FIRE) - 15 workers trapped; Road accident on Mirpur Road (HIGH, ROAD_ACCIDENT) - Bus collision, 8 injured; Building damage in Motijheel (MEDIUM, BUILDING_COLLAPSE) - Cracks in commercial building.",
      "Available resources: Fire Extinguishers: 20 units at Dhanmondi Fire Station; Ambulances: 3 available at Dhaka Medical College.",
      "Generate 5-7 concise safety advisories for the community."
    ].join(" ");

    const raw = await groqChat(ADVISORY_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result.advisories.length).toBeGreaterThanOrEqual(5);
    expect(result.advisories.length).toBeLessThanOrEqual(7);
  }, TIMEOUT_MS);

  it("returns valid JSON structure even with minimal context", async () => {
    const userContent = [
      "Active incidents: Minor waterlogging in Gulshan (LOW, FLOOD) at Gulshan-2 - Drains overflowing.",
      "Available resources: none nearby.",
      "Generate 5-7 concise safety advisories for the community."
    ].join(" ");

    const raw = await groqChat(ADVISORY_SYSTEM_PROMPT, userContent);
    const result = JSON.parse(raw);

    expect(result).toHaveProperty("advisories");
    expect(Array.isArray(result.advisories)).toBe(true);
    expect(result.advisories.length).toBeGreaterThanOrEqual(5);
  }, TIMEOUT_MS);
});

// ─── EXPORT PROMPTS FOR COMPARISON ──────────────────────────────────────────────

export const IMPROVED_PROMPTS = {
  classifier: CLASSIFIER_SYSTEM_PROMPT,
  similarity: SIMILARITY_SYSTEM_PROMPT,
  advisory: ADVISORY_SYSTEM_PROMPT
};
