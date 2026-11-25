/*
  # Return visits alongside Bible studies

  Not everyone a publisher calls back on is studying. A return visit is someone met
  in the ministry who showed interest and is worth going back to; some of them later
  become studies. Both are people with an address, a publication, notes and a
  history of calls, so they share the `students` table rather than living in two
  ledgers that would have to be merged the day a return visit starts studying.

  1. Changes to `students`
    - `status` ('return_visit' | 'study', default 'study'): what this person is to
      the publisher right now. Every existing row is a study.
    - `preferred_days` (smallint[], default '{}'): the weekdays they are usually
      home, 0 = Sunday to 6 = Saturday (the same numbering as field service days).
    - `preferred_time` (text, optional): when on those days, e.g. "Evening".
    - `next_visit_date` (date, optional): a day they asked to be called on.

  2. Changes to `student_visits`
    - `is_study` (boolean, default true): whether this call was a Bible study. It
      is stored per call, not read off the person, so a return visit who becomes a
      study later does not retroactively turn their earlier calls into studies on
      past reports. Every existing visit is a study.

  3. Security
    - No new tables, so the existing row-level policies on both tables cover these
      columns.

  Ids for both tables may now be created on the device (so a return visit added
  with no signal can be queued and replayed); `gen_random_uuid()` stays the default
  for rows created any other way.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'study',
  ADD COLUMN IF NOT EXISTS preferred_days smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_time text,
  ADD COLUMN IF NOT EXISTS next_visit_date date;

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check
  CHECK (status IN ('return_visit', 'study'));

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_preferred_days_check;
ALTER TABLE students ADD CONSTRAINT students_preferred_days_check
  CHECK (preferred_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]);

CREATE INDEX IF NOT EXISTS students_user_status_idx ON students(user_id, status);

ALTER TABLE student_visits
  ADD COLUMN IF NOT EXISTS is_study boolean NOT NULL DEFAULT true;
