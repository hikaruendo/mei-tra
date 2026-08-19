-- Guests (anonymous sign-ins) are throwaway accounts, but the avatars bucket is
-- public, so anything they upload stays publicly reachable until the orphan
-- sweep reclaims it after the account is purged. Block writes at the RLS layer
-- so the rule holds for direct Storage API calls too, not just our REST
-- endpoint. SELECT stays public and DELETE stays open, so an avatar uploaded
-- before this migration can still be removed by its owner.
--
-- is_anonymous flips to false once an upgraded account confirms its email, and
-- the claim refreshes with the next token, so registering lifts the block.

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
