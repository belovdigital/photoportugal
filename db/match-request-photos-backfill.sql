-- Backfill num_photos for match options curated before the column existed.
-- Prefer the package whose price the admin actually quoted; fall back to the
-- cheapest public one. Only rows still awaiting a client's choice matter.
UPDATE match_request_photographers mrp
   SET num_photos = COALESCE(
     (SELECT pk.num_photos FROM packages pk
       WHERE pk.photographer_id = mrp.photographer_id AND pk.is_public = TRUE
         AND pk.custom_for_user_id IS NULL AND pk.price = mrp.price
       ORDER BY pk.num_photos DESC LIMIT 1),
     (SELECT pk.num_photos FROM packages pk
       WHERE pk.photographer_id = mrp.photographer_id AND pk.is_public = TRUE
         AND pk.custom_for_user_id IS NULL
       ORDER BY pk.price ASC LIMIT 1)
   )
 WHERE mrp.num_photos IS NULL;

SELECT count(*) FILTER (WHERE num_photos IS NULL) AS still_null,
       count(*) FILTER (WHERE num_photos IS NOT NULL) AS filled,
       count(*) AS total
  FROM match_request_photographers;
