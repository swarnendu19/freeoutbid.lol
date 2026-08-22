import { database } from "../../../db/client";

export const runtime = "nodejs";

type ListingRow = { id: number; domain: string; url: string; description: string; bid: number; clicks: number; free_bids_remaining: number; bid_limit: number; updated_at: string };

const blockedDomains = new Set([
  "redgifs.com",
  "grindr.com",
  "pornhub.com",
  "xhamster.com",
  "rip.website",
  "rip.this.website",
]);

function isBlockedDomain(domain: string) {
  return blockedDomains.has(domain) || /^[0-9a-f]{16}\.rip(?:\.com)?$/i.test(domain);
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
    SELECT id, domain, url, description, bid, clicks, free_bids_remaining, bid_limit, updated_at
    FROM listings WHERE bid > 0 ORDER BY bid DESC, updated_at ASC LIMIT 100`;
  const matches = normalized ? await sql<ListingRow[]>`
    SELECT id, domain, url, description, bid, clicks, free_bids_remaining, bid_limit, updated_at
    FROM listings WHERE domain = ${normalized.domain} LIMIT 1` : [];
  return Response.json({ listings, profile: matches[0] ?? { domain: normalized?.domain, url: normalized?.url, bid: 0, free_bids_remaining: 3, bid_limit: 100 } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: "click"; url?: string; amount?: number } | null;
  const normalized = body?.url ? normalizeUrl(body.url) : null;
  if (!normalized) return Response.json({ error: "Enter a valid domain or product URL." }, { status: 400 });
  if (body?.action !== "click" && isBlockedDomain(normalized.domain)) {
    return Response.json({ error: "This domain is not permitted on the leaderboard." }, { status: 400 });
  }
  const sql = database();
  if (body?.action === "click") {
    await sql`UPDATE listings SET clicks = clicks + 1 WHERE domain = ${normalized.domain}`;
    return Response.json({ ok: true });
  }
  const amount = Math.round(Number(body?.amount));
  if (!Number.isFinite(amount) || amount < 1) return Response.json({ error: "Bid must be at least $1." }, { status: 400 });

  const outcome = await sql.begin(async (tx) => {
    await tx`INSERT INTO listings (domain, url) VALUES (${normalized.domain}, ${normalized.url}) ON CONFLICT (domain) DO NOTHING`;
    const current = await tx<{ bid: number; free_bids_remaining: number; bid_limit: number }[]>`
      SELECT bid, free_bids_remaining, bid_limit FROM listings WHERE domain = ${normalized.domain} FOR UPDATE`;
    const state = current[0];
    if (amount <= state.bid) return { status: 409, error: "BID_NOT_HIGHER", message: `This URL is already at $${state.bid}. Enter at least $${state.bid + 1}.` };
    if (state.free_bids_remaining <= 0) return { status: 409, error: "FREE_BIDS_GONE", message: "All 3 free bids are gone. Continue with Polar to place another bid." };
    if (amount > state.bid_limit) return { status: 409, error: "LIMIT_EXCEEDED", message: `Your current free-bid limit is $${state.bid_limit}. Lower the bid or pay the exact amount with Polar.` };
    const updated = await tx<ListingRow[]>`
      UPDATE listings SET url = ${normalized.url}, bid = ${amount},
        free_bids_remaining = free_bids_remaining - 1,
        bid_limit = LEAST(400, bid_limit + 100), updated_at = NOW()
      WHERE domain = ${normalized.domain}
      RETURNING id, domain, url, description, bid, clicks, free_bids_remaining, bid_limit, updated_at`;
    return { status: 200, listing: updated[0] };
  });
  if (outcome.status !== 200) return Response.json({ error: outcome.error, message: outcome.message }, { status: outcome.status });
  return Response.json({ listing: outcome.listing });
}
