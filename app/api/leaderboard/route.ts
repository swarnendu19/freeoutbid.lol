import { createHash } from "node:crypto";
import { database } from "../../../db/client";
import { isBlockedDomain } from "../../../lib/domain-policy";

export const runtime = "nodejs";

type ListingRow = { id: number; domain: string; url: string; title: string; description: string; screenshots: string[]; bid: number; clicks: number; is_paid: boolean; is_example: boolean; updated_at: string };
let clickTableReady: Promise<void> | null = null;

function ensureClickTable() {
  if (!clickTableReady) {
    const sql = database();
    clickTableReady = sql`
      CREATE TABLE IF NOT EXISTS listing_clicks (
        domain TEXT NOT NULL,
        visitor_hash TEXT NOT NULL,
        clicked_on DATE NOT NULL DEFAULT CURRENT_DATE,
        PRIMARY KEY (domain, visitor_hash, clicked_on)
      )`.then(() => undefined);
  }
  return clickTableReady;
}

function normalizeUrl(input: string) {
  try {
    const parsed = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    if (!parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    return { domain: parsed.hostname.replace(/^www\./i, "").toLowerCase(), url: parsed.toString() };
  } catch { return null; }
}

export async function GET(request: Request) {
  const sql = database();
  const requested = new URL(request.url).searchParams.get("url");
  const normalized = requested ? normalizeUrl(requested) : null;
  const listings = await sql<ListingRow[]>`
    SELECT l.id, l.domain, l.url, l.title, l.description, l.screenshots, l.bid, l.clicks, l.updated_at,
      (l.listing_kind IN ('paid', 'example')) AS is_paid,
      (l.listing_kind = 'example') AS is_example
    FROM listings l WHERE l.bid > 0 ORDER BY is_example DESC, is_paid DESC, l.bid DESC, l.updated_at ASC LIMIT 100`;
  const matches = normalized ? await sql<ListingRow[]>`
    SELECT l.id, l.domain, l.url, l.title, l.description, l.screenshots, l.bid, l.clicks, l.updated_at,
      (l.listing_kind IN ('paid', 'example')) AS is_paid,
      (l.listing_kind = 'example') AS is_example
    FROM listings l WHERE l.domain = ${normalized.domain} LIMIT 1` : [];
  return Response.json({ listings, profile: matches[0] ?? { domain: normalized?.domain, url: normalized?.url, bid: 0, is_paid: false } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: "click"; url?: string; amount?: number } | null;
  const normalized = body?.url ? normalizeUrl(body.url) : null;
  if (!normalized) return Response.json({ error: "Enter a valid domain or product URL." }, { status: 400 });
  if (body?.action !== "click" && isBlockedDomain(normalized.domain)) {
    return Response.json({ error: "This domain is not permitted on the leaderboard." }, { status: 400 });
  }
  if (body?.action === "click") {
    await ensureClickTable();
    const sql = database();
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const visitorHash = createHash("sha256").update(`${forwardedFor}|${userAgent}`).digest("hex").slice(0, 32);
    const updated = await sql<{ clicks: number }[]>`
      WITH accepted AS (
        INSERT INTO listing_clicks (domain, visitor_hash)
        SELECT ${normalized.domain}, ${visitorHash}
        WHERE EXISTS (
          SELECT 1 FROM listings WHERE domain = ${normalized.domain} AND listing_kind IN ('paid', 'example')
        )
        ON CONFLICT DO NOTHING
        RETURNING domain
      )
      UPDATE listings SET clicks = clicks + 1
      WHERE domain IN (SELECT domain FROM accepted)
      RETURNING clicks`;
    if (updated.length) return Response.json({ ok: true, counted: true, clicks: updated[0].clicks });
    const current = await sql<{ clicks: number }[]>`
      SELECT clicks FROM listings WHERE domain = ${normalized.domain} AND listing_kind IN ('paid', 'example') LIMIT 1`;
    return Response.json({ ok: true, counted: false, clicks: current[0]?.clicks ?? 0 });
  }
  return Response.json({
    error: "Free bids are disabled. Use Polar checkout; a protected free-listing application form is coming soon.",
  }, { status: 402 });
}
