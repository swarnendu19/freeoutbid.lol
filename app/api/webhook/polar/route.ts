import { Webhooks } from "@polar-sh/nextjs";
import { database } from "../../../../db/client";
import { isBlockedDomain } from "../../../../lib/domain-policy";

export const runtime = "nodejs";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",
  onOrderPaid: async (payload) => {
    const order = payload.data;
    const domain = typeof order.metadata.domain === "string" ? order.metadata.domain.toLowerCase() : "";
    const amount = Number(order.metadata.bid_amount_usd);
    const title = typeof order.metadata.title === "string" ? order.metadata.title.slice(0, 100) : domain;
    const description = typeof order.metadata.description === "string" ? order.metadata.description.slice(0, 320) : "A product competing on the public board.";
    let screenshots: string[] = [];
    try {
      const parsed = JSON.parse(typeof order.metadata.screenshots_json === "string" ? order.metadata.screenshots_json : "[]");
      if (Array.isArray(parsed)) screenshots = parsed.filter((value): value is string => typeof value === "string" && value.startsWith("https://")).slice(0, 6);
    } catch { screenshots = []; }
    if (!domain.includes(".") || isBlockedDomain(domain) || !Number.isInteger(amount) || amount < 1 || amount > 10000) return;
    const sql = database();
    await sql.begin(async (tx) => {
      const previousPayments = await tx<{ exists: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM processed_payments WHERE domain = ${domain}) AS exists`;
      const inserted = await tx<{ order_id: string }[]>`
        INSERT INTO processed_payments (order_id, domain, amount)
        VALUES (${order.id}, ${domain}, ${amount}) ON CONFLICT (order_id) DO NOTHING RETURNING order_id`;
      if (!inserted.length) return;
      if (previousPayments[0]?.exists) {
        await tx`
          INSERT INTO listings (domain, url, title, description, screenshots, bid, listing_kind)
          VALUES (${domain}, ${`https://${domain}`}, ${title}, ${description}, ${screenshots}, ${amount}, 'paid')
          ON CONFLICT (domain) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
            screenshots = EXCLUDED.screenshots, bid = GREATEST(listings.bid, EXCLUDED.bid), listing_kind = 'paid', updated_at = NOW()`;
      } else {
        await tx`
          INSERT INTO listings (domain, url, title, description, screenshots, bid, listing_kind)
          VALUES (${domain}, ${`https://${domain}`}, ${title}, ${description}, ${screenshots}, ${amount}, 'paid')
          ON CONFLICT (domain) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
            screenshots = EXCLUDED.screenshots, bid = EXCLUDED.bid, listing_kind = 'paid', updated_at = NOW()`;
      }
    });
  },
});
