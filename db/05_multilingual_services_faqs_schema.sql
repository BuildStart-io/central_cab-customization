-- ============================================================================
-- Migration: Add Category to FAQs, Multi-Service Groups & Anti-Ban Rate Limiting
-- Dedicated schema: central_cab
-- ============================================================================

-- 1. Add category column to central_cab.faqs
ALTER TABLE IF EXISTS central_cab.faqs 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'ask_a_question';

CREATE INDEX IF NOT EXISTS idx_central_cab_faqs_category 
ON central_cab.faqs(user_id, category);

-- 2. Update default settings routine
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

    -- Initialize default Multi-Service Groups and Anti-Ban Delay Settings
    INSERT INTO central_cab.settings (user_id, key, value)
    VALUES (
        _user_id,
        'cab_system_settings',
        '{
            "admin_whatsapp_number": "",
            "broadcast_delay_seconds": 3,
            "hire_driver_groups": [],
            "rent_a_car_groups": [],
            "delivery_driver_groups": [],
            "target_driver_groups": []
        }'::jsonb
    )
    ON CONFLICT (user_id, key) DO UPDATE 
    SET value = central_cab.settings.value || '{
        "broadcast_delay_seconds": 3,
        "hire_driver_groups": coalesce(central_cab.settings.value->''hire_driver_groups'', central_cab.settings.value->''target_driver_groups'', ''[]''::jsonb),
        "rent_a_car_groups": coalesce(central_cab.settings.value->''rent_a_car_groups'', ''[]''::jsonb),
        "delivery_driver_groups": coalesce(central_cab.settings.value->''delivery_driver_groups'', central_cab.settings.value->''target_driver_groups'', ''[]''::jsonb)
    }'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
