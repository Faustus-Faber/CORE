import "dotenv/config";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const required: string[] = isTest
  ? []
  : ["JWT_SECRET", "DATABASE_URL", "GROQ_API_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const configuredCorsOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins =
  configuredCorsOrigins && configuredCorsOrigins.length > 0
    ? [...configuredCorsOrigins]
    : ["http://localhost:5173", "http://127.0.0.1:5173"];

for (const origin of [...corsOrigins]) {
  if (origin.includes("localhost")) {
    const alias = origin.replace("localhost", "127.0.0.1");
    if (!corsOrigins.includes(alias)) {
      corsOrigins.push(alias);
    }
  } else if (origin.includes("127.0.0.1")) {
    const alias = origin.replace("127.0.0.1", "localhost");
    if (!corsOrigins.includes(alias)) {
      corsOrigins.push(alias);
    }
  }
}

export const env = {
  port: parsePort(process.env.PORT ?? "5000"),
  corsOrigins,
  jwtSecret: process.env.JWT_SECRET ?? "test-secret",
  groqApiKey: process.env.GROQ_API_KEY ?? "test-key",
  groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://opencode.ai/zen/go/v1",
  groqWhisperApiKey: process.env.GROQ_WHISPER_API_KEY ?? process.env.GROQ_API_KEY ?? "test-key",
  groqWhisperModel: process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3",
  groqWhisperBaseUrl: process.env.GROQ_WHISPER_BASE_URL ?? "https://api.groq.com/openai/v1",
  groqQwenModel: process.env.GROQ_QWEN_MODEL ?? "deepseek-v4-flash",
  groqVisionModel: process.env.GROQ_VISION_MODEL ?? "mimo-v2.5",
  aiRequestTimeoutMs: parsePositiveInt("AI_REQUEST_TIMEOUT_MS", process.env.AI_REQUEST_TIMEOUT_MS, 20000),
  // Brevo (primary email provider — replaces Resend)
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  brevoFromEmail: process.env.BREVO_FROM_EMAIL ?? "core.dispatch@example.com",
  brevoFromName: process.env.BREVO_FROM_NAME ?? "CORE Dispatch",
  // Legacy Resend fallback (kept for backward compatibility)
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail:
    process.env.RESEND_FROM_EMAIL ?? "CORE Dispatch <onboarding@resend.dev>",
  ocrProvider: process.env.OCR_PROVIDER ?? "ocrspace",
  ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY ?? "",
  ocrSpaceEndpoint: process.env.OCR_SPACE_ENDPOINT ?? "https://api.ocr.space/parse/image",
  ocrRequestTimeoutMs: parsePositiveInt("OCR_REQUEST_TIMEOUT_MS", process.env.OCR_REQUEST_TIMEOUT_MS, 30000)
};

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535 (got "${raw}")`);
  }
  return port;
}

function parsePositiveInt(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1000) {
    throw new Error(`${name} must be a valid number >= 1000 (got "${raw}")`);
  }
  return value;
}
