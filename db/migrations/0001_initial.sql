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

INSERT INTO listings (domain, url, title, description, bid, listing_kind, screenshots)
VALUES (
  'contextkit.swarn.me',
  'https://contextkit.swarn.me/',
  'Contextkit — Stop re-explaining your project to AI',
  'A workflow layer for Claude Code, Codex, and every AI coding agent: persistent context, guided planning, slop detection, and memorable short commands.',
  1,
  'example',
  ARRAY['/contextkit/contextkit-hero.png','/contextkit/contextkit-flow.png','/contextkit/contextkit-slop.png','/contextkit/contextkit-skills.png','/contextkit/contextkit-commands.png','/contextkit/contextkit-price.png']
)
ON CONFLICT (domain) DO UPDATE SET
  url = EXCLUDED.url,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  bid = EXCLUDED.bid,
  listing_kind = EXCLUDED.listing_kind,
  screenshots = EXCLUDED.screenshots,
  updated_at = NOW();

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

UPDATE listings SET listing_kind = 'paid'
WHERE listing_kind <> 'example'
  AND EXISTS (SELECT 1 FROM processed_payments p WHERE p.domain = listings.domain);

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
