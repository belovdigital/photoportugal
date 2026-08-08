-- Group the language versions of one blog topic.
--
-- hreflang for a post was computed by asking which locales publish the SAME
-- slug. Translations do not share a slug — "photographing-rome-guide" and
-- "fotografare-roma-guida" are the same article — so every post declared
-- itself the only version that exists and no reader or crawler was ever
-- handed the other language.
--
-- Nullable: a post with no sibling simply has no group and keeps behaving
-- exactly as before.
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS translation_group text;
CREATE INDEX IF NOT EXISTS idx_blog_posts_translation_group
  ON blog_posts (translation_group) WHERE translation_group IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('003_blog_translation_group.sql')
ON CONFLICT DO NOTHING;
