import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const migration = await fs.readFile(path.join(process.cwd(), "db/migrations/0001_initial.sql"), "utf8");
await sql.unsafe(migration);
await sql.end();
console.log("Database migration completed.");
