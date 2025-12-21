import { recordsTable, sentencesTable, wordsTable } from "@/db/schema";
import { db } from "drizzle.config";

const host = "https://twtsl.ccu.edu.tw";

let total = 0;

for (let index = 1; index <= 20; index++) {
  console.log(`--- Processing stroke ${index}`);

  const { Record: records } = await fetch(
    `${host}/api/pinSearch?value=${index}&lang=zh&pageSize=1000&field=stroke`,
  ).then((res) => res.json());

  for (const item of records as { id: number; name: string }[]) {
    console.log(`${item.id} ${item.name}`);
    total++;

    const { Record: recordDetail } = await fetch(
      `${host}/api/querySearch?id=${item.id}&lang=zh`,
    ).then((res) => res.json());

    const { Record: sentence } = await fetch(
      `${host}/api/sentence?id=${item.id}&lang=zh`,
    ).then(async (res) => await res.json());

    const record = recordDetail[0];

    await db
      .insert(recordsTable)
      .values({
        id: record.id,
        description: record.description,
        clip: `${host}/${record.clip}.mp4`,
        stroke: record.stroke,
        polysemy: record.polysemy,
      })
      .onConflictDoNothing();

    if (sentence.length > 0) {
      for (const sent of sentence as {
        gloss: string;
        translation: string;
        clip: string;
      }[]) {
        await db
          .insert(sentencesTable)
          .values({
            recordId: record.id,
            gloss: sent.gloss,
            translation: sent.translation,
            clip: `${host}/${sent.clip}.mp4`,
          })
          .onConflictDoNothing();
      }
    }

    await db
      .insert(wordsTable)
      .values({
        word: record.name,
        recordId: record.id,
      })
      .onConflictDoNothing();

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

console.log(`Total records: ${total}`);
