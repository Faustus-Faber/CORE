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
  port: Number(process.env.PORT ?? 5000),
  corsOrigins,
  jwtSecret: process.env.JWT_SECRET ?? "test-secret",
  groqApiKey: process.env.GROQ_API_KEY ?? "test-groq-key",
  groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
  groqWhisperModel: process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3",
  textAnalysisApiBaseUrl:
    process.env.TEXT_ANALYSIS_API_BASE_URL ??
    "https://lintiest-alissa-brigandishly.ngrok-free.dev",
  aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 20000)
};
