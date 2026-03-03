import "dotenv/config";

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
const required: string[] = isTest ? [] : ["JWT_SECRET", "DATABASE_URL"];

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
  jwtSecret: process.env.JWT_SECRET ?? "test-secret"
};
