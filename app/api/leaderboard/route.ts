import { database } from "../../../db/client";
import { isBlockedDomain } from "../../../lib/domain-policy";

export const runtime = "nodejs";

type ListingRow = { id: number; domain: string; url: string; description: string; bid: number; clicks: number; updated_at: string };

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
    SELECT id, domain, url, description, bid, clicks, updated_at
    FROM listings WHERE bid > 0 ORDER BY bid DESC, updated_at ASC LIMIT 100`;
  const matches = normalized ? await sql<ListingRow[]>`
    SELECT id, domain, url, description, bid, clicks, updated_at
    FROM listings WHERE domain = ${normalized.domain} LIMIT 1` : [];
  return Response.json({ listings, profile: matches[0] ?? { domain: normalized?.domain, url: normalized?.url, bid: 0 } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: "click"; url?: string; amount?: number } | null;
  const normalized = body?.url ? normalizeUrl(body.url) : null;
  if (!normalized) return Response.json({ error: "Enter a valid domain or product URL." }, { status: 400 });
  if (body?.action !== "click" && isBlockedDomain(normalized.domain)) {
    return Response.json({ error: "This domain is not permitted on the leaderboard." }, { status: 400 });
  }
  if (body?.action === "click") {
    const sql = database();
    await sql`UPDATE listings SET clicks = clicks + 1 WHERE domain = ${normalized.domain}`;
    return Response.json({ ok: true });
  }
  return Response.json({
    error: "Free bids are disabled. Use Polar checkout, or follow @SwarnCode on X to request a manually reviewed free listing.",
  }, { status: 402 });
}
