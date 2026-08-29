import { database } from "../db/client";
import LeaderboardClient, { type Listing } from "./leaderboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DatabaseListing = Omit<Listing, "updated_at"> & { updated_at: Date | string };
let metricsTableReady: Promise<void> | null = null;

function ensureMetricsTable() {
  if (!metricsTableReady) {
    const sql = database();
    metricsTableReady = sql`
      CREATE TABLE IF NOT EXISTS site_metrics (
        metric_key TEXT PRIMARY KEY,
        metric_value BIGINT NOT NULL CHECK (metric_value >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`.then(() => undefined);
  }
  return metricsTableReady;
}

async function loadListings(): Promise<Listing[]> {
  const sql = database();
  // One-time production cleanup for the retired hard-coded example listing.
  await sql`DELETE FROM listings WHERE listing_kind = 'example' OR domain = 'contextkit.swarn.me'`;
  const rows = await sql<DatabaseListing[]>`
    SELECT l.id, l.domain, l.url, l.title, l.description, l.screenshots, l.bid, l.clicks, l.updated_at,
      (l.listing_kind = 'paid') AS is_paid
    FROM listings l
    WHERE l.bid > 0
    ORDER BY is_paid DESC, l.bid DESC, l.updated_at ASC
    LIMIT 100`;

  return rows.map((row) => ({
    ...row,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  }));
}

async function recordLifetimeView(): Promise<number> {
  const sql = database();
  await ensureMetricsTable();
  const rows = await sql<{ metric_value: number | string }[]>`
    INSERT INTO site_metrics (metric_key, metric_value)
    VALUES ('lifetime_views', 458)
    ON CONFLICT (metric_key) DO UPDATE SET
      metric_value = site_metrics.metric_value + 1,
      updated_at = NOW()
    RETURNING metric_value`;
  return Number(rows[0]?.metric_value ?? 458);
}

export default async function Home() {
  let initialListings: Listing[] = [];
  let lifetimeViews = 458;

  try {
    [initialListings, lifetimeViews] = await Promise.all([loadListings(), recordLifetimeView()]);
  } catch (error) {
    console.error("Failed to load homepage data", error);
  }

  return <LeaderboardClient initialListings={initialListings} lifetimeViews={lifetimeViews} />;
}
