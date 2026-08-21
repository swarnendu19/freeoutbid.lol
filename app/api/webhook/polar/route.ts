import { Webhooks } from "@polar-sh/nextjs";
import { database } from "../../../../db/client";

export const runtime = "nodejs";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",
  onOrderPaid: async (payload) => {
    const order = payload.data;
    const domain = typeof order.metadata.domain === "string" ? order.metadata.domain.toLowerCase() : "";
    const amount = Number(order.metadata.bid_amount_usd);
    if (!domain.includes(".") || !Number.isInteger(amount) || amount < 1 || amount > 10000) return;
    const sql = database();
    await sql.begin(async (tx) => {
      const inserted = await tx<{ order_id: string }[]>`
        INSERT INTO processed_payments (order_id, domain, amount)
        VALUES (${order.id}, ${domain}, ${amount}) ON CONFLICT (order_id) DO NOTHING RETURNING order_id`;
      if (!inserted.length) return;
      await tx`
        INSERT INTO listings (domain, url, bid) VALUES (${domain}, ${`https://${domain}`}, ${amount})
        ON CONFLICT (domain) DO UPDATE SET bid = GREATEST(listings.bid, EXCLUDED.bid), updated_at = NOW()`;
    });
  },
});
