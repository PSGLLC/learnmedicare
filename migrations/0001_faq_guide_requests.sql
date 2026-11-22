-- Stores only a random request key and processing state; never name, email,
-- message, IP address, webhook payload, or consent data.
CREATE TABLE IF NOT EXISTS faq_guide_requests (
  request_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('processing', 'accepted', 'ambiguous')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS faq_guide_requests_created_at_idx
  ON faq_guide_requests(created_at);
