-- ============================================================================
-- Ceylon Central Cabs & Delivery Schema Migration
-- Dedicated isolated schema: central_cab
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS central_cab;

-- 1. Grant usage permissions on central_cab schema
GRANT USAGE ON SCHEMA central_cab TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA central_cab TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA central_cab TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA central_cab TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA central_cab GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA central_cab GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA central_cab GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 2. Settings table for Central Cabs
CREATE TABLE IF NOT EXISTS central_cab.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_central_cab_setting UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_central_cab_settings_user_key ON central_cab.settings(user_id, key);

-- 3. Bot Sessions (State Machine) for 1-on-1 Chats
CREATE TABLE IF NOT EXISTS central_cab.bot_sessions (
    phone_number TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    flow_type TEXT DEFAULT 'IDLE',       -- 'IDLE', 'CAB_FLOW', 'DELIVERY_FLOW'
    current_step TEXT DEFAULT 'WELCOME', -- 'WELCOME', 'CAB_NAME', 'CAB_PHONE', etc.
    session_data JSONB DEFAULT '{}'::jsonb,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_central_cab_bot_sessions_user ON central_cab.bot_sessions(user_id);

-- 4. Orders Table
CREATE TABLE IF NOT EXISTS central_cab.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT NOT NULL UNIQUE,     -- E.g. #ORD845
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,          -- 'transport' | 'delivery'
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,          -- 'Motorbike', 'Three-wheeler', 'Car', 'Van', 'Lorry', 'Bus'
    pickup_address TEXT NOT NULL,
    pickup_coords JSONB,                -- {"lat": 7.2906, "lng": 80.6337}
    dropoff_address TEXT NOT NULL,
    dropoff_coords JSONB,               -- {"lat": 7.2600, "lng": 80.5900}
    trip_type TEXT,                      -- 'one_way' | 'round_trip' (for transport)
    delivery_items TEXT,                 -- (for delivery)
    distance_km NUMERIC(8,2) NOT NULL,
    base_price NUMERIC(10,2) NOT NULL,
    per_km_rate NUMERIC(10,2) NOT NULL,
    coverage_km NUMERIC(8,2) NOT NULL,
    discount_percentage NUMERIC(5,2) DEFAULT 0,
    total_fare NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',       -- 'pending', 'assigned', 'confirmed', 'completed', 'cancelled'
    assigned_voice_url TEXT,
    assigned_voice_note_id TEXT,
    broadcasted_groups JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_central_cab_orders_user ON central_cab.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_central_cab_orders_code ON central_cab.orders(order_code);
CREATE INDEX IF NOT EXISTS idx_central_cab_orders_status ON central_cab.orders(status);

-- 5. Message Queue for Central Cabs
CREATE TABLE IF NOT EXISTS central_cab.message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    wsender_message_id TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    sender_name TEXT,
    message_text TEXT,
    message_type TEXT DEFAULT 'text',
    session_api_key TEXT,
    raw_payload JSONB,
    status TEXT DEFAULT 'pending',       -- 'pending', 'processing', 'done', 'failed', 'dead'
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    error_message TEXT,
    correlation_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_central_cab_queue_status ON central_cab.message_queue(status, created_at);

-- 6. Conversations Table (History Log)
CREATE TABLE IF NOT EXISTS central_cab.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message TEXT,
    direction TEXT NOT NULL,             -- 'inbound' | 'outbound'
    message_type TEXT DEFAULT 'text',    -- 'text', 'location', 'audio', 'ptt', etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_central_cab_conversations_user_phone ON central_cab.conversations(user_id, phone_number);

-- 7. Helper functions for settings initialization
CREATE OR REPLACE FUNCTION central_cab.init_default_settings(_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Initialize default Vehicle Pricing
    INSERT INTO central_cab.settings (user_id, key, value)
    VALUES (
        _user_id,
        'cab_pricing',
        '{
            "motorbike": { "base_price": 200, "per_km_rate": 80, "coverage_km": 2, "discount_percentage": 10 },
            "three_wheeler": { "base_price": 300, "per_km_rate": 100, "coverage_km": 2, "discount_percentage": 10 },
            "car": { "base_price": 600, "per_km_rate": 150, "coverage_km": 3, "discount_percentage": 15 },
            "van": { "base_price": 900, "per_km_rate": 200, "coverage_km": 3, "discount_percentage": 15 },
            "lorry": { "base_price": 1500, "per_km_rate": 300, "coverage_km": 5, "discount_percentage": 10 },
            "bus": { "base_price": 3000, "per_km_rate": 500, "coverage_km": 10, "discount_percentage": 10 }
        }'::jsonb
    )
    ON CONFLICT (user_id, key) DO NOTHING;

    -- Initialize default System Settings
    INSERT INTO central_cab.settings (user_id, key, value)
    VALUES (
        _user_id,
        'cab_system_settings',
        '{
            "admin_whatsapp_number": "",
            "target_driver_groups": []
        }'::jsonb
    )
    ON CONFLICT (user_id, key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Enable Row Level Security (RLS) on all central_cab tables
ALTER TABLE central_cab.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_cab.bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_cab.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_cab.message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_cab.conversations ENABLE ROW LEVEL SECURITY;

-- Settings Policies
DROP POLICY IF EXISTS "Users can manage own settings" ON central_cab.settings;
CREATE POLICY "Users can manage own settings" ON central_cab.settings
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on settings" ON central_cab.settings;
CREATE POLICY "Service role full access on settings" ON central_cab.settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Bot Sessions Policies
DROP POLICY IF EXISTS "Users can manage own bot sessions" ON central_cab.bot_sessions;
CREATE POLICY "Users can manage own bot sessions" ON central_cab.bot_sessions
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on bot sessions" ON central_cab.bot_sessions;
CREATE POLICY "Service role full access on bot sessions" ON central_cab.bot_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Orders Policies
DROP POLICY IF EXISTS "Users can manage own orders" ON central_cab.orders;
CREATE POLICY "Users can manage own orders" ON central_cab.orders
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on orders" ON central_cab.orders;
CREATE POLICY "Service role full access on orders" ON central_cab.orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Message Queue Policies
DROP POLICY IF EXISTS "Users can view own message queue" ON central_cab.message_queue;
CREATE POLICY "Users can view own message queue" ON central_cab.message_queue
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on message queue" ON central_cab.message_queue;
CREATE POLICY "Service role full access on message queue" ON central_cab.message_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Conversations Policies
DROP POLICY IF EXISTS "Users can manage own conversations" ON central_cab.conversations;
CREATE POLICY "Users can manage own conversations" ON central_cab.conversations
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on conversations" ON central_cab.conversations;
CREATE POLICY "Service role full access on conversations" ON central_cab.conversations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

