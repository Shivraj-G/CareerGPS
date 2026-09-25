-- Phase 8: ingestion/review workflow hardening.
CREATE INDEX IF NOT EXISTS idx_sources_approved_type ON sources(is_approved, source_type);
CREATE INDEX IF NOT EXISTS idx_source_documents_fetched_at ON source_documents(source_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON ingestion_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_candidates_entity_status ON ingestion_candidates(entity_type, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
