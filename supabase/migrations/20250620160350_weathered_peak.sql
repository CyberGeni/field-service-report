/*
  # Add field_service_days_config column to user_settings table

  1. Changes
    - Add `field_service_days_config` column to `user_settings` table
    - Column type: jsonb (nullable)
    - This will store structured field service day configuration data

  2. Purpose
    - Allows storing detailed field service day configurations including day, type, potential hours, and labels
    - Provides more flexibility than the existing field_service_days integer array
    - Maintains backward compatibility with existing field_service_days column
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