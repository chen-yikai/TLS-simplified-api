import { relations } from "drizzle-orm/relations";
import { records, words, sentences } from "./schema";

export const wordsRelations = relations(words, ({one}) => ({
	record: one(records, {
		fields: [words.recordId],
		references: [records.id]
	}),
}));

export const recordsRelations = relations(records, ({many}) => ({
	words: many(words),
	sentences: many(sentences),
}));

export const sentencesRelations = relations(sentences, ({one}) => ({
	record: one(records, {
		fields: [sentences.recordId],
		references: [records.id]
	}),
}));