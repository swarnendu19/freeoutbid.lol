import postgres from "postgres";

const globalDatabase = globalThis as typeof globalThis & { freeoutbidSql?: ReturnType<typeof postgres> };

export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  if (!globalDatabase.freeoutbidSql) {
    globalDatabase.freeoutbidSql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return globalDatabase.freeoutbidSql;
}
