/*
  # Merge return visit service type with house to house

  1. Database Changes
    - Update existing 'rv' service records to 'h2h' type
    - Update service_records table constraint to only allow 'h2h' and 'cart'
    - Add field_service_days_config column for enhanced field service day configuration

  2. Data Migration
    - Convert all 'rv' type records to 'h2h' type
    - Preserve all existing data and timestamps
*/

-- Add the field_service_days_config column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'field_service_days_config'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN field_service_days_config jsonb;
  END IF;
END $$;

-- Update existing 'rv' service records to 'h2h' type
UPDATE service_records 
SET type = 'h2h' 
WHERE type = 'rv';

-- Drop the old constraint
ALTER TABLE service_records DROP CONSTRAINT IF EXISTS service_records_type_check;

-- Add new constraint with only 'h2h' and 'cart' types
ALTER TABLE service_records ADD CONSTRAINT service_records_type_check 
CHECK (type = ANY (ARRAY['h2h'::text, 'cart'::text]));