import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  API_PORT: z.string().default("3456"),
});

export const env = envSchema.parse(process.env);
