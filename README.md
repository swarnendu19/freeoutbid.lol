# freeoutbid.lol

A no-signup product leaderboard where each URL starts with three free bids. Higher bids rank higher, while paid bids use Polar checkout.

## Stack

- Next.js 16 and React 19
- PostgreSQL via `postgres.js`
- Polar checkout and verified `order.paid` webhooks
- Tailwind CSS 4

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Configure the values in `.env.local` before running migrations. Never commit real credentials.

## Production

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Run `npm run db:migrate` during release.
3. Configure `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER=production`, and `SITE_URL=https://freeoutbid.lol`.
4. In Polar, register `https://freeoutbid.lol/api/webhook/polar` for the `order.paid` event.
5. Deploy with Node.js 22 and run `npm run build` followed by `npm start`.

Paid-bid processing is idempotent: repeated Polar webhook deliveries cannot apply the same order twice.
