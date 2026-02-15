import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import { env } from "../env.js";
import { logger } from "../utils/logger.js";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

pool.on("error", (err) => {
  logger.error(err, "Unexpected PostgreSQL pool error");
});

export const db = drizzle(pool, { schema });

export async function closeDb() {
  await pool.end();
  logger.info("Database pool closed");
}
