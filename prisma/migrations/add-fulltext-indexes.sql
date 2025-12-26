-- PostgreSQL Full-Text Search Indexes
-- Run this migration after the initial schema migration if you need full-text search
-- Note: These are optional and can be added later for better search performance

-- Full-text search index on document names
CREATE INDEX IF NOT EXISTS documents_name_fts_idx ON documents USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS documents_original_name_fts_idx ON documents USING gin(to_tsvector('english', original_name));

-- Full-text search index on chunk content
CREATE INDEX IF NOT EXISTS chunks_content_fts_idx ON chunks USING gin(to_tsvector('english', content));

-- Full-text search index on queries
CREATE INDEX IF NOT EXISTS queries_query_fts_idx ON queries USING gin(to_tsvector('english', query));

-- Helper function for full-text search queries
-- Example usage:
-- SELECT * FROM chunks WHERE to_tsvector('english', content) @@ to_tsquery('english', 'search term');

