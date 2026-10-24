import assert from "node:assert/strict";
import { test } from "node:test";
import { generate } from "../src/services/assistant.ts";
import { csvCell, parseRows } from "../../ui/src/lib/files.ts";

test("AI validates input before requests and returns safe provider failures", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(() => generate({ kind: "voice", text: "facts" }), /GEMINI_API_KEY/);
    process.env.GEMINI_API_KEY = "test-secret";
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response("private provider details", { status: 403 });
    };
    await assert.rejects(() => generate({ kind: "ocr", file: "AAAA", mimeType: "audio/webm" }));
    await assert.rejects(() => generate({ kind: "lessons", text: "topic", duration: 0 }));
    assert.equal(calls, 0);
    await assert.rejects(
      () => generate({ kind: "voice", text: "facts" }),
      (error) =>
        error instanceof Error &&
        !error.message.includes("test-secret") &&
        !error.message.includes("private provider"),
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: '[{"name":"Сурагч","score":null,"attendance":""}]' }] } },
          ],
        }),
      );
    assert.deepEqual(
      JSON.parse(await generate({ kind: "ocr", file: "AAAA", mimeType: "image/png" })),
      [{ name: "Сурагч", score: null, attendance: "" }],
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: '[{"name":"A","score":999,"attendance":""}]' }] } },
          ],
        }),
      );
    await assert.rejects(() => generate({ kind: "ocr", file: "AAAA", mimeType: "image/png" }));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("Excel CSV escapes formulas, delimiters and quoted multiline names", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell(" +SUM(A1)"), '"\' +SUM(A1)"');
  assert.equal(csvCell('A,"B"\nC'), '"A,""B""\nC"');
  assert.equal(csvCell(null), '""');
});

test("table parsing preserves unreadable grades and rejects invalid stored data", () => {
  assert.deepEqual(parseRows('[{"name":"A","score":null,"attendance":""}]'), [
    { name: "A", score: null, attendance: "" },
  ]);
  assert.throws(() => parseRows('[{"name":"A","score":101,"attendance":""}]'));
  assert.throws(() => parseRows('{"rows":[]}'));
});
