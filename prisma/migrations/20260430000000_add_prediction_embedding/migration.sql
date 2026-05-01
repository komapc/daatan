CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS predictions_embedding_hnsw_idx
  ON predictions USING hnsw (embedding vector_cosine_ops);
