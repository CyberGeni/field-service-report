/*
  # Track which monthly reports have been sent

  1. New Tables
    - `report_submissions` - one row per month a report was copied for
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `month` (text, YYYY-MM)
      - `rounding` (text, how the odd minutes were handled)
      - `logged_minutes` (integer, what the log held when the report went out)
      - `carried_in_minutes` (integer, minutes brought forward from the month before)
      - `reported_minutes` (integer, what actually went on the report)
      - `carryover_minutes` (integer, minutes pushed onto the next month)
      - `copied_at` (timestamp of the copy that settled the month)
      - `created_at` / `updated_at` (timestamps)

    - `report_tracking` - one row per user, marking when this ledger began
      - `user_id` (uuid, primary key, foreign key to auth.users)
      - `start_month` (text, YYYY-MM)
      - `created_at` / `updated_at` (timestamps)

    Reports sent before the feature existed were never recorded, so months before
    `start_month` are left unjudged rather than shown as unreported.

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage only their own rows
*/

-- Months a report has been copied for
CREATE TABLE IF NOT EXISTS report_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL,
  rounding text NOT NULL DEFAULT 'asIs'
    CHECK (rounding IN ('asIs', 'carryOver', 'roundUp', 'roundDown')),
  logged_minutes integer NOT NULL DEFAULT 0 CHECK (logged_minutes >= 0),
  carried_in_minutes integer NOT NULL DEFAULT 0 CHECK (carried_in_minutes >= 0),
  reported_minutes integer NOT NULL DEFAULT 0 CHECK (reported_minutes >= 0),
  carryover_minutes integer NOT NULL DEFAULT 0 CHECK (carryover_minutes >= 0),
  copied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- A month is either reported or it isn't; copying again replaces the record
  UNIQUE (user_id, month)
);

ALTER TABLE report_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own report submissions"
  ON report_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own report submissions"
  ON report_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own report submissions"
  ON report_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own report submissions"
  ON report_submissions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS report_submissions_user_month_idx
  ON report_submissions(user_id, month DESC);

CREATE TRIGGER report_submissions_updated_at
  BEFORE UPDATE ON report_submissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- When this ledger started for each user
CREATE TABLE IF NOT EXISTS report_tracking (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  start_month text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE report_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own report tracking"
  ON report_tracking
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own report tracking"
  ON report_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own report tracking"
  ON report_tracking
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER report_tracking_updated_at
  BEFORE UPDATE ON report_tracking
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
