import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL environment variable is required");
  }
  // Allow local dev fallback only outside production
}
const resolvedConnection =
  connectionString ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const client = postgres(resolvedConnection);

export const db = drizzle(client, { schema });
export type Database = typeof db;
