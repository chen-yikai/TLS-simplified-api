import { wordsTable } from "@/db/schema";
import { env, pipeline } from "@huggingface/transformers";
import * as t from "drizzle-orm";
import { db } from "drizzle.config";

env.cacheDir = "./model_cache";
const extractor = await pipeline("feature-extraction", "Xenova/bge-m3", {
  dtype: "fp32",
});

console.log("words table will be processed for embedding generation...");

const words = await db.select().from(wordsTable);

for (const item of words) {
  const wordWithoutTag = item.word;
  const output = await extractor(wordWithoutTag, {
    pooling: "mean",
    normalize: true,
  });
  const vector = Array.from(output.data);
  await db
    .update(wordsTable)
    .set({ embedding: vector })
    .where(t.eq(wordsTable.id, item.id));
  console.log(`${item.id} ${item.word} UPDATED!!!`);
}
