/*
  # Add field_service_days_config column for enhanced field service day configuration

  1. Changes
    - Add field_service_days_config jsonb column to user_settings table
    - This will store the new FieldServiceDay structure with type, hours, and labels
    - Keep the existing field_service_days column for backward compatibility

  2. Security
    - No changes to RLS policies needed
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