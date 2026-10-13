-- Migration 023: Opportunity Notifications System
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('new_opportunity', 'closing_soon')),
  urgency VARCHAR(30) NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', '7_days', '3_days', '24_hours')),
  title VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500),
  idempotency_key VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_notifications_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created ON user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread ON user_notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_opp_id ON user_notifications (opportunity_id);
