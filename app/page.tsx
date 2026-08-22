import { database } from "../db/client";
import LeaderboardClient, { type Listing } from "./leaderboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DatabaseListing = Omit<Listing, "updated_at"> & { updated_at: Date | string };

async function loadListings(): Promise<Listing[]> {
  const sql = database();
  const rows = await sql<DatabaseListing[]>`
    SELECT l.id, l.domain, l.url, l.description, l.bid, l.clicks, l.updated_at,
      EXISTS (SELECT 1 FROM processed_payments p WHERE p.domain = l.domain) AS is_paid
    FROM listings l
    WHERE l.bid > 0
    ORDER BY is_paid DESC, l.bid DESC, l.updated_at ASC
    LIMIT 100`;

  return rows.map((row) => ({
    ...row,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  }));
}

export default async function Home() {
  let initialListings: Listing[] = [];

  try {
    initialListings = await loadListings();
  } catch (error) {
    console.error("Failed to load the initial leaderboard", error);
  }

  return <LeaderboardClient initialListings={initialListings} />;
}
