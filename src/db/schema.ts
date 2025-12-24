import * as t from "drizzle-orm/pg-core";

export const recordsTable = t.pgTable("records", {
  id: t.integer().primaryKey(),
  name: t.text(),
  description: t.text(),
  clip: t.text(),
  stroke: t.integer(),
  polysemy: t.integer(),
});

export const wordsTable = t.pgTable(
  "words",
  {
    id: t.integer().primaryKey().generatedByDefaultAsIdentity(),
    word: t.text().notNull(),
    recordId: t.integer().references(() => recordsTable.id),
    embedding: t.vector("embedding", { dimensions: 1024 }),
  },
  (table) => [
    t.unique("unique_word_recordId").on(table.recordId, table.word),
    t
      .index("embeddingIndex")
      .using("hnsw", table.embedding.op("vector_cosine_ops")),
  ],
);

export const sentencesTable = t.pgTable(
  "sentences",
  {
    id: t.integer().primaryKey().generatedByDefaultAsIdentity(),
    recordId: t.integer().references(() => recordsTable.id),
    gloss: t.text().notNull(),
    translation: t.text().notNull(),
    clip: t.text().notNull(),
  },
  (table) => [t.unique().on(table.recordId, table.gloss, table.translation)],
);
