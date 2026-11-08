-- Create order_broadcast_queue table for asynchronous group broadcasting via cron
CREATE TABLE IF NOT EXISTS central_cab.order_broadcast_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT NOT NULL,
    user_id UUID NOT NULL,
    group_chat_id TEXT NOT NULL,
    group_name TEXT,
    message_text TEXT NOT NULL,
    session_api_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_broadcast_queue_pending 
  ON central_cab.order_broadcast_queue (status, created_at) 
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_order_broadcast_queue_order 
  ON central_cab.order_broadcast_queue (order_code);

GRANT ALL ON central_cab.order_broadcast_queue TO postgres, anon, authenticated, service_role;
