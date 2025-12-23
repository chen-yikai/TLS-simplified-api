ALTER TABLE "words" ADD COLUMN "embedding" vector(284);--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "words" USING hnsw ("embedding" vector_cosine_ops);