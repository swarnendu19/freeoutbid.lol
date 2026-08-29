CREATE TABLE IF NOT EXISTS listings (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT 'A product competing on the public board.',
  bid INTEGER NOT NULL DEFAULT 0 CHECK (bid >= 0),
  clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  free_bids_remaining INTEGER NOT NULL DEFAULT 3 CHECK (free_bids_remaining BETWEEN 0 AND 3),
  bid_limit INTEGER NOT NULL DEFAULT 100 CHECK (bid_limit BETWEEN 100 AND 400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_bid_updated
ON listings (bid DESC, updated_at ASC);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS screenshots TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS listing_kind TEXT NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS processed_payments (
  order_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_clicks (
  domain TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  clicked_on DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (domain, visitor_hash, clicked_on)
);

CREATE TABLE IF NOT EXISTS site_metrics (
  metric_key TEXT PRIMARY KEY,
  metric_value BIGINT NOT NULL CHECK (metric_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_metrics (metric_key, metric_value)
VALUES ('lifetime_views', 458)
ON CONFLICT (metric_key) DO NOTHING;

UPDATE listings SET listing_kind = 'paid'
WHERE EXISTS (SELECT 1 FROM processed_payments p WHERE p.domain = listings.domain);

-- Retire the old hard-coded example so only genuine paid bids can rank as paid.
DELETE FROM listings
WHERE listing_kind = 'example' OR domain = 'contextkit.swarn.me';

-- Emergency cleanup for the pornography and randomized-domain spam flood.
DELETE FROM listings
WHERE domain IN (
  'redgifs.com',
  'grindr.com',
  'pornhub.com',
  'xhamster.com',
  'rip.website',
  'rip.this.website'
)
OR domain ~ '^[0-9a-f]{16}\.(rip(\.com)?|epstein\.files|stop\.vibe\.coding)$';
