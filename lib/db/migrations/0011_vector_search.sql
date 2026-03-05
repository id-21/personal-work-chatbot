CREATE OR REPLACE FUNCTION vector_search(
  query_embedding vector(1536),
  match_count int,
  p_user_id uuid,
  filter_pursuits text[] DEFAULT NULL
)
RETURNS TABLE (id uuid, text text, tags text[], importance float, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.text,
    mc.tags::text[],
    mc.importance::float,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM memory_chunks mc
  WHERE
    mc."userId" = p_user_id
    AND mc."supersededBy" IS NULL
    AND (filter_pursuits IS NULL OR mc."linkedPursuits"::text[] && filter_pursuits)
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END; $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS memory_chunks_embedding_idx
ON memory_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

