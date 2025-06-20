/*
  # Create service records table

  1. New Tables
    - `service_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `date` (date)
      - `hours` (integer)
      - `minutes` (integer)
      - `type` (text, enum: h2h, rv, cart)
      - `notes` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `service_records` table
    - Add policies for authenticated users to manage their own records

  3. Indexes
    - Add index on user_id and date for efficient queries
*/

CREATE TABLE IF NOT EXISTS service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  hours integer NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('h2h', 'rv', 'cart')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own service records"
  ON service_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own service records"
  ON service_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own service records"
  ON service_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own service records"
  ON service_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS service_records_user_date_idx 
  ON service_records(user_id, date DESC);

CREATE INDEX IF NOT EXISTS service_records_user_created_idx 
  ON service_records(user_id, created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER service_records_updated_at
  BEFORE UPDATE ON service_records
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();