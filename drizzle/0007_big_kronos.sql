ALTER TABLE "words" DROP CONSTRAINT "words_recordId_word_unique";--> statement-breakpoint
ALTER TABLE "sentences" ALTER COLUMN "gloss" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sentences" ALTER COLUMN "translation" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sentences" ALTER COLUMN "clip" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "words" ALTER COLUMN "word" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "unique_word_recordId" UNIQUE("recordId","word");