type CheckoutRequest = { domain?: unknown; amount?: unknown };

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
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!domain || !domain.includes(".") || !Number.isFinite(amount) || amount < 1 || amount > 10000) return Response.json({ error: "Provide a valid domain and bid between $1 and $10,000." }, { status: 400 });

  const polarResponse = await fetch(`${apiBase}/v1/checkouts/`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      products: [productId],
      prices: { [productId]: [{ amount_type: "fixed", price_amount: Math.round(amount * 100), price_currency: "usd" }] },
      metadata: { domain, bid_amount_usd: amount.toString(), source: "freeoutbid.lol" },
      success_url: `${siteUrl}/?payment=success&checkout_id={CHECKOUT_ID}`,
      return_url: siteUrl,
    }),
  });
  const checkout = await polarResponse.json() as { url?: string; detail?: string };
  if (!polarResponse.ok || !checkout.url) return Response.json({ error: checkout.detail || "Polar could not create this checkout." }, { status: 502 });
  return Response.json({ url: checkout.url });
}
