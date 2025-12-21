import * as t from "drizzle-orm/pg-core";

export const recordsTable = t.pgTable("records", {
  id: t.integer().primaryKey(),
  description: t.text(),
  clip: t.text(),
  stroke: t.integer(),
  polysemy: t.integer(),
});

export const wordsTable = t.pgTable("words", {
  id: t.integer().primaryKey().generatedByDefaultAsIdentity(),
  word: t.text(),
  recordId: t.integer().references(() => recordsTable.id),
});

export const sentencesTable = t.pgTable("sentences", {
  id: t.integer().primaryKey().generatedByDefaultAsIdentity(),
  recordId: t.integer().references(() => recordsTable.id),
  gloss: t.text(),
  translation: t.text(),
  clip: t.text(),
});
