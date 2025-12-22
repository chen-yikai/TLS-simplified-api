import { pgTable, integer, text, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const records = pgTable("records", {
  id: integer().primaryKey().notNull(),
  description: text(),
  clip: text(),
  stroke: integer(),
  polysemy: integer(),
});

export const words = pgTable(
  "words",
  {
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "words_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    word: text(),
    recordId: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.recordId],
      foreignColumns: [records.id],
      name: "words_recordId_records_id_fk",
    }),
  ],
);

export const sentences = pgTable(
  "sentences",
  {
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({
        name: "sentences_id_seq",
        startWith: 1,
        increment: 1,
        minValue: 1,
        maxValue: 2147483647,
        cache: 1,
      }),
    recordId: integer(),
    gloss: text(),
    translation: text(),
    clip: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.recordId],
      foreignColumns: [records.id],
      name: "sentences_recordId_records_id_fk",
    }),
  ],
);
