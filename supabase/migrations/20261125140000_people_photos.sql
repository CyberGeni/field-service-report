/*
  # Photos of where people live

  A return visit is often found again by a door, not an address: a flat with no
  number, a house down an unnamed lane. A photo taken on the doorstep fixes that.

  Unlike avatars these are private - a photo of someone's home is nobody else's
  business - so the bucket is not public and every policy is scoped to the folder
  named after the owner's user id (`<user id>/<person id>/<photo>.jpg`).

  1. Changes
    - `students.photo_path` (text, optional): the photo's path in the bucket.
    - `people-photos` storage bucket: private, images only, 5MB per file (photos are
      shrunk on the phone first, to a few hundred KB).

  2. Security
    - Users can read, add, replace and delete only the files in their own folder.
*/

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS photo_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('people-photos', 'people-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Users can view their own people photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can add their own people photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can replace their own people photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own people photos" ON storage.objects;

CREATE POLICY "Users can view their own people photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'people-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can add their own people photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'people-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can replace their own people photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'people-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'people-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own people photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'people-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
