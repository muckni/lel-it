import { sql } from "drizzle-orm";
import { db } from "@owit/db";

/**
 * Look up a Supabase auth user id by email (case-insensitive).
 * `auth.users` is not modeled in Drizzle, so this uses raw SQL.
 * Returns null when no user matches.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const rows = (await db.execute(
    sql`select id from auth.users where lower(email) = ${normalized} limit 1`
  )) as unknown as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}
