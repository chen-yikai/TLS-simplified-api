ALTER TABLE "sentences" ADD CONSTRAINT "sentences_gloss_unique" UNIQUE("gloss");--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_word_unique" UNIQUE("word");