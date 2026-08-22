import { database } from "../../../db/client";
import { isBlockedDomain } from "../../../lib/domain-policy";

export const runtime = "nodejs";

type ListingRow = { id: number; domain: string; url: string; description: string; bid: number; clicks: number; is_paid: boolean; updated_at: string };

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
    SELECT l.id, l.domain, l.url, l.description, l.bid, l.clicks, l.updated_at,
      EXISTS (SELECT 1 FROM processed_payments p WHERE p.domain = l.domain) AS is_paid
    FROM listings l WHERE l.bid > 0 ORDER BY is_paid DESC, l.bid DESC, l.updated_at ASC LIMIT 100`;
  const matches = normalized ? await sql<ListingRow[]>`
    SELECT l.id, l.domain, l.url, l.description, l.bid, l.clicks, l.updated_at,
      EXISTS (SELECT 1 FROM processed_payments p WHERE p.domain = l.domain) AS is_paid
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
    // Click writes are temporarily disabled to prevent unauthenticated traffic
    // from exhausting serverless database connections.
    return Response.json({ ok: true });
  }
  return Response.json({
    error: "Free bids are disabled. Use Polar checkout, or DM @SwarnCode on X to request a manually reviewed free listing.",
  }, { status: 402 });
}
