/*
  # Add field_service_days_config column to user_settings

  1. Changes
    - Add `field_service_days_config` column to `user_settings` table
    - This column will store the full configuration for field service days as JSON
    - Set default to NULL to allow gradual migration

  2. Notes
    - The existing `field_service_days` column (integer array) will remain for backward compatibility
    - New column uses JSONB for better performance and querying capabilities
*/

-- Add the missing field_service_days_config column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'field_service_days_config'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN field_service_days_config jsonb DEFAULT NULL;
  END IF;
END $$;