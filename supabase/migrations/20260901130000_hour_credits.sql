/*
  # Hour credits: theocratic school and volunteer work

  Some publishers are awarded hours they did not spend in field service. They fall
  into two kinds, and the difference is why they are not one setting:

    - Theocratic school credit is issued once, for attending (a pioneer school is
      30 hours). Anyone can be given one, so it needs no gate.
    - Volunteer credit is ongoing - LDC and other volunteer assignments award hours
      for the work done. Only publishers who actually hold a volunteer assignment
      ever see it, which is what `profiles.is_volunteer` is for.

  1. Changes
    - `profiles.is_volunteer` (boolean, default false) - whether volunteer logging
      is offered to this user at all. Off for everyone until they turn it on.
    - `service_records.type` accepts `volunteer` and `school` alongside the two
      preaching types, so credits live in the same log as everything else and are
      counted, reported and shown on the calendar without a parallel ledger.

  2. Security
    - No new tables, so the existing row-level policies on both tables already cover
      these columns and rows.
*/

-- Volunteer status is opt-in: the option is hidden until a user says otherwise
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_volunteer boolean NOT NULL DEFAULT false;

-- Credits are service records with their own type rather than a separate table
ALTER TABLE service_records DROP CONSTRAINT IF EXISTS service_records_type_check;

ALTER TABLE service_records ADD CONSTRAINT service_records_type_check
  CHECK (type = ANY (ARRAY['h2h'::text, 'cart'::text, 'volunteer'::text, 'school'::text]));
