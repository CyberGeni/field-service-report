/*
  # Create student visits table

  1. New Tables
    - `student_visits`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key to students)
      - `user_id` (uuid, foreign key to auth.users)
      - `visit_date` (date)
      - `place_stopped` (text, where in publication we stopped)
      - `notes` (text, notes from the visit)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `student_visits` table
    - Add policies for authenticated users to manage their own student visits

  3. Changes to students table
    - Add `place_stopped` column to students table for current place
*/

-- Create student_visits table
CREATE TABLE IF NOT EXISTS student_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  place_stopped text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE student_visits ENABLE ROW LEVEL SECURITY;

-- Create policies for student visits
CREATE POLICY "Users can read own student visits"
  ON student_visits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own student visits"
  ON student_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own student visits"
  ON student_visits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own student visits"
  ON student_visits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS student_visits_student_id_idx ON student_visits(student_id);
CREATE INDEX IF NOT EXISTS student_visits_user_id_idx ON student_visits(user_id);
CREATE INDEX IF NOT EXISTS student_visits_date_idx ON student_visits(student_id, visit_date DESC);

-- Create trigger for updated_at
CREATE TRIGGER student_visits_updated_at
  BEFORE UPDATE ON student_visits
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Add place_stopped column to students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'place_stopped'
  ) THEN
    ALTER TABLE students ADD COLUMN place_stopped text;
  END IF;
END $$;