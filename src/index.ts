import swagger from "@elysiajs/swagger";
import { pipeline, env } from "@huggingface/transformers";
import { db } from "drizzle.config";
import Elysia, { t } from "elysia";
import { recordsTable, sentencesTable, wordsTable } from "./db/schema";
import { eq, sql, cosineDistance, desc } from "drizzle-orm";
import cors from "@elysiajs/cors";

env.cacheDir = "./model_cache";
const extractor = await pipeline("feature-extraction", "Xenova/bge-m3", {
  dtype: "fp32",
});
console.log("Model loaded successfully");

new Elysia()
  .use(cors())
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "台灣手語辭典",
          description: "https://twtsl.ccu.edu.tw",
          version: "1.0",
        },
        servers: [
          { url: "/api", description: "front-end proxy connection" },
          { url: "/", description: "direct server connection" },
        ],
      },
      provider: "swagger-ui",
    }),
  )
  .get(
    "/details",
    async ({ query, status }) => {
      const record = await db.query.recordsTable.findFirst({
        where: eq(recordsTable.id, query.id),
      });
      const word = await db.query.wordsTable.findMany({
        where: eq(wordsTable.recordId, query.id),
      });
      const sentences = await db.query.sentencesTable.findMany({
        where: eq(sentencesTable.recordId, query.id),
      });
      if (!record) return status(404, { message: "Record not found" });
      return {
        id: record.id,
        name: record.name,
        description: record.description,
        stroke: record.stroke,
        polysemy: record.polysemy,
        clip: record.clip,
        sentences: [...sentences.map((sentence) => sentence)],
        polysemyWords: [...word.map((w) => w.word)],
      };
    },
    {
      query: t.Object(
        {
          id: t.Numeric(),
        },
        {
          error: () => ({ message: "Invalid query parameters" }),
        },
      ),
      detail: {
        description: "Get detailed information about a specific word by ID.",
        summary: "Get word details by id",
        tags: ["dictionary"],
      },
    },
  )
  .get(
    "/search",
    async ({ query }) => {
      const output = await extractor(query.q, {
        pooling: "mean",
        normalize: true,
      });
      const queryVector = Array.from(output.data);
      const words = await db
        .select({
          word: wordsTable.word,
          recordId: wordsTable.recordId,
          similarity: sql<number>`1 - (${cosineDistance(
            wordsTable.embedding,
            queryVector,
          )})`,
        })
        .from(wordsTable)
        .where(
          sql`1 - (${cosineDistance(wordsTable.embedding, queryVector)}) > 0.5`,
        )
        .orderBy((t) => desc(t.similarity))
        .limit(query.limit ?? 5);

      return {
        results: words.map((word, index) => ({
          id: index,
          recordId: word.recordId,
          name: word.word,
        })),
        total: words.length,
      };
    },
    {
      query: t.Object(
        {
          q: t.Union([t.String(), t.Array(t.String())]),
          limit: t.Optional(t.Numeric()),
        },
        {
          error: () => ({ message: "Invalid query parameters" }),
        },
      ),
      detail: {
        description:
          "Search words in the words dataset, leave 'q' empty to get all words.",
        summary: "Search words or get all words",
        tags: ["dictionary"],
      },
    },
  )
  .post(
    "/translate",
    async ({ query }) => {
      const cutText = await TranslateResult(query.source);
      const results: TranslateResult[] = [];
      for (const word of cutText) {
        const output = await extractor(word, {
          pooling: "mean",
          normalize: true,
        });
        const queryVector = Array.from(output.data);
        const result = await db.query.wordsTable.findFirst({
          extras: {
            similarity: sql<number>`1 - (${cosineDistance(
              wordsTable.embedding,
              queryVector,
            )})`.as("similarity"),
          },
          where: (table, { sql }) =>
            sql`1 - (${cosineDistance(table.embedding, queryVector)}) > 0.5`,
          orderBy: () => sql`similarity DESC`,
        });
        if (result?.recordId) {
          const record = await db.query.recordsTable.findFirst({
            where: eq(recordsTable.id, result.recordId),
          });
          results.push({
            recordId: result.recordId,
            result: result.word,
            source: word,
            sourceInfo: {
              clip: record?.clip,
              description: record?.description,
            },
          });
        }
      }
      return {
        query: query.source,
        results,
        total: results.length,
      };
    },
    {
      query: t.Object({
        source: t.String(),
      }),
      detail: {
        summary: "Translate text with existing words in dataset",
        tags: ["feature"],
      },
    },
  )
  .listen(process.env.PORT ?? 3000);

console.log(`Server is fireup on port ${process.env.PORT ?? 3000}`);

async function TranslateResult(query: any): Promise<string[]> {
  const req = await fetch(`${process.env.OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen2.5:3b",
      system:
        "你是台灣手語專家。請嚴格遵守語序：[主詞] > [動詞] > [受詞或形容詞] 。\n規則：1.不可遺漏任何詞彙。 2.動詞與否定詞必須拆開。 3.只輸出純 JSON 陣列。 4.避免讓結果包含非中文字元。 5.適當斷句。",
      prompt: `輸入："我喜歡吃蘋果" -> ["蘋果", "我", "喜歡", "吃"]\n輸入："昨天我在學校沒看見老師" -> ["昨天", "學校", "老師", "我", "看見", "沒"]\n輸入："${query}" -> `,
      stream: false,
    }),
  });
  const res = await req.json();
  console.log("Translate:", res.response);
  return JSON.parse(res.response);
}
