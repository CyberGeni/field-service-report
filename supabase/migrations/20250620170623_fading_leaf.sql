/*
  # Add field service days configuration column

  1. Changes
    - Add `field_service_days_config` column to store the full FieldServiceDay structure
    - This column will store JSON data with day, type, potentialHours, and label

  2. Migration Safety
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Preserves existing data
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