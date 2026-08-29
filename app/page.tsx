import { database } from "../db/client";
import LeaderboardClient, { type Listing } from "./leaderboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DatabaseListing = Omit<Listing, "updated_at"> & { updated_at: Date | string };
type VemetricAnalyticsResponse = { data?: Array<{ metrics?: { pageviews?: number } }> };
type VemetricProjectResponse = { project?: { createdAt?: string; firstEventAt?: string | null } };

async function loadListings(): Promise<Listing[]> {
  const sql = database();
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

async function loadVemetricViews(): Promise<number | null> {
  const apiKey = process.env.VEMETRIC_API_KEY;
  if (!apiKey) return null;

  try {
    const projectResponse = await fetch("https://api.vemetric.com/v1/project", {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 3600 },
    });
    if (!projectResponse.ok) {
      console.error(`Vemetric project request failed with status ${projectResponse.status}`);
      return null;
    }
    const project = await projectResponse.json() as VemetricProjectResponse;
    const firstEventAt = project.project?.firstEventAt ?? project.project?.createdAt;
    if (!firstEventAt) return 0;

    const startDate = firstEventAt.slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const response = await fetch("https://api.vemetric.com/v1/analytics/query", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dateRange: [startDate, endDate], metrics: ["pageviews"], groupBy: [], limit: 1, offset: 0 }),
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      console.error(`Vemetric analytics request failed with status ${response.status}`);
      return null;
    }
    const result = await response.json() as VemetricAnalyticsResponse;
    const pageviews = result.data?.[0]?.metrics?.pageviews;
    return typeof pageviews === "number" && Number.isFinite(pageviews) ? Math.max(0, Math.round(pageviews)) : null;
  } catch (error) {
    console.error("Failed to load Vemetric page views", error);
    return null;
  }
}

export default async function Home() {
  let initialListings: Listing[] = [];
  let vemetricViews: number | null = null;

  try {
    [initialListings, vemetricViews] = await Promise.all([loadListings(), loadVemetricViews()]);
  } catch (error) {
    console.error("Failed to load homepage data", error);
  }

  return <LeaderboardClient initialListings={initialListings} vemetricViews={vemetricViews} />;
}
