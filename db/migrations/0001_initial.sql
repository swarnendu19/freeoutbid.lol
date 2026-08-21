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

CREATE TABLE IF NOT EXISTS processed_payments (
  order_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO listings (domain, url, description, bid, clicks) VALUES
  ('appgrowthkit.com', 'https://appgrowthkit.com', 'Screenshot tools for ambitious app teams.', 96, 1284),
  ('usemotionkit.com', 'https://usemotionkit.com', 'A focused motion library for product teams.', 78, 912),
  ('tinylaunch.dev', 'https://tinylaunch.dev', 'Launch pages made for independent builders.', 61, 740),
  ('readme.so', 'https://readme.so', 'Turn product knowledge into clear documentation.', 42, 488),
  ('foundercrm.com', 'https://foundercrm.com', 'A lightweight relationship manager for founders.', 27, 301)
ON CONFLICT (domain) DO NOTHING;
