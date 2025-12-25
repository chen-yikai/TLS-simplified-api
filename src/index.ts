import swagger from "@elysiajs/swagger";
import { pipeline, env } from "@huggingface/transformers";
import { db } from "drizzle.config";
import Elysia, { t } from "elysia";
import { recordsTable, sentencesTable, wordsTable } from "./db/schema";
import { eq, sql, cosineDistance, desc } from "drizzle-orm";
import cors from "@elysiajs/cors";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const config = {
  thinkingConfig: {
    thinkingLevel: ThinkingLevel.MINIMAL,
  },
};
const model = "gemini-3-flash-preview";
const instruction = {
  system:
    "你是一個台灣手語翻譯專家。你的任務是將用戶輸入的中文句子轉換成台灣手語的手勢序列。台灣手語的語法順序通常是：受詞-主詞-動詞 或 話題-評論的結構",
  rules: {
    format: "[手勢1]/[手勢2]/[手勢3]",
    order: "台灣手語語序：通常把被動者/對象放在前面，再跟主動者，最後是動作",
    priority: "優先使用常用的台灣手語單字",
    outputType: "純JSON，嚴禁其他內容",
    syntaxExample: "中文 '爸爸很愛媽媽' 應轉換為'媽媽/爸爸/愛'",
    notice:
      "不要重複問題，直接給出翻譯結果。不限定手勢數量，但要完整表達句子意思",
  },
  outputExamples: [
    {
      input: "爸爸很愛媽媽",
      output: ["媽媽", "爸爸", "愛"],
    },
    {
      input: "我喜歡吃蘋果",
      output: ["蘋果", "我", "喜歡", "吃"],
    },
    {
      input: "她在圖書館讀書",
      output: ["圖書館", "她", "讀書"],
    },
  ],
};

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
          results.push({
            recordId: result.recordId,
            result: result.word,
            source: word,
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
  const response = await ai.models.generateContentStream({
    model,
    config,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${JSON.stringify(instruction)}
            \nInput: ${query}`,
          },
        ],
      },
    ],
  });

  let responseText = "";
  for await (const chunk of response) {
    responseText += chunk.text;
  }
  return JSON.parse(responseText);
}
