-- Extend the existing opaque FAQ request ledger for the direct GHL API path.
-- Only keyed hashes are stored; raw email addresses and client IPs are not.
ALTER TABLE faq_guide_requests ADD COLUMN recipient_hash TEXT;
ALTER TABLE faq_guide_requests ADD COLUMN ip_hash TEXT;
ALTER TABLE faq_guide_requests ADD COLUMN outcome TEXT NOT NULL DEFAULT 'legacy';

-- A recipient can have only one in-flight or ambiguous request. Queued and
-- known non-send outcomes release the lock, allowing a deliberate later ID.
CREATE UNIQUE INDEX faq_guide_one_active_request_per_recipient_idx
  ON faq_guide_requests(recipient_hash)
  WHERE recipient_hash IS NOT NULL AND status IN ('processing', 'ambiguous');

-- Atomic fixed-window limits: 3 requests per recipient/day, 10 per IP/hour,
-- and 50 total requests per day.
-- Keys are HMACs made with a separate secret; this table holds no PII.
CREATE TABLE IF NOT EXISTS faq_guide_rate_limits (
  scope TEXT NOT NULL CHECK (scope IN ('recipient_day', 'ip_hour', 'global_day')),
  key_hash TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (scope, key_hash, bucket_start)
);

CREATE INDEX IF NOT EXISTS faq_guide_rate_limits_bucket_idx
  ON faq_guide_rate_limits(bucket_start);
