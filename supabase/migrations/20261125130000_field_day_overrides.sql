/*
  # One-off days off and extra field service days

  The usual week (`field_service_days_config`) says which days a publisher goes out.
  Real months have exceptions: a wedding on a Saturday that is usually spent in the
  field, or an extra Tuesday to make up for it. The monthly plan has to know about
  both to share the month's hours over the days that will really be worked.

  1. Changes
    - `user_settings.day_overrides` (jsonb, default '[]'): a list of
      `{ "date": "YYYY-MM-DD", "kind": "off" | "out", "type"?: "h2h" | "cart",
         "potentialHours"?: number, "note"?: string }`.
      `off` takes a date out of the plan; `out` puts one in (or changes its hours).
      Kept with the rest of the settings so it loads, caches and syncs with them.

  2. Security
    - No new tables, so the existing row-level policies on user_settings cover it.
*/

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS day_overrides jsonb NOT NULL DEFAULT '[]'::jsonb;
