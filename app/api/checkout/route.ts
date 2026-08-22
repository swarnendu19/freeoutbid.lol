import { isBlockedDomain } from "../../../lib/domain-policy";

type CheckoutRequest = { domain?: unknown; url?: unknown; amount?: unknown; title?: unknown; description?: unknown; screenshots?: unknown };

function screenshotUrls(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 6).flatMap((value) => {
    if (typeof value !== "string" || value.length > 500) return [];
    try {
      const url = new URL(value);
      const isVercelBlob = url.hostname.endsWith(".public.blob.vercel-storage.com");
      return url.protocol === "https:" && isVercelBlob ? [url.toString()] : [];
    }
    catch { return []; }
  });
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  const productId = process.env.POLAR_PRODUCT_ID;
  const apiBase = process.env.POLAR_SERVER === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";
  const siteUrl = process.env.SITE_URL ?? "https://freeoutbid.lol";
  if (!accessToken || !productId) return Response.json({ error: "Polar checkout is wired but needs POLAR_ACCESS_TOKEN and POLAR_PRODUCT_ID." }, { status: 503 });
  let body: CheckoutRequest;
  try { body = await request.json() as CheckoutRequest; } catch { return Response.json({ error: "Invalid checkout request." }, { status: 400 }); }
  const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
  const listingUrl = typeof body.url === "string" ? body.url.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 320) : "";
  const screenshots = screenshotUrls(body.screenshots);
  if (!domain || !domain.includes(".") || !Number.isFinite(amount) || amount < 1 || amount > 10000) return Response.json({ error: "Provide a valid domain and bid between $1 and $10,000." }, { status: 400 });
  try {
    const parsedUrl = new URL(listingUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname.replace(/^www\./i, "").toLowerCase() !== domain) throw new Error();
  } catch { return Response.json({ error: "Provide a matching HTTPS listing URL." }, { status: 400 }); }
  if (!title || !description) return Response.json({ error: "Provide a listing title and short description." }, { status: 400 });
  if (isBlockedDomain(domain)) return Response.json({ error: "This domain is not permitted on the leaderboard." }, { status: 400 });

  const polarResponse = await fetch(`${apiBase}/v1/checkouts/`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      products: [productId],
      prices: { [productId]: [{ amount_type: "fixed", price_amount: Math.round(amount * 100), price_currency: "usd" }] },
      metadata: { domain, listing_url: listingUrl, bid_amount_usd: amount.toString(), title, description, screenshots_json: JSON.stringify(screenshots), source: "freeoutbid.lol" },
      success_url: `${siteUrl}/?payment=success&checkout_id={CHECKOUT_ID}`,
      return_url: siteUrl,
    }),
  });
  const checkout = await polarResponse.json() as { url?: string; detail?: string };
  if (!polarResponse.ok || !checkout.url) return Response.json({ error: checkout.detail || "Polar could not create this checkout." }, { status: 502 });
  return Response.json({ url: checkout.url });
}
