-- Preserve the provider's accepted message ID for manual status reconciliation.
-- This does not mark delivery; the initial outcome remains `queued`.
ALTER TABLE faq_guide_requests ADD COLUMN provider_message_id TEXT;
