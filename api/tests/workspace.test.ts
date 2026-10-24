import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvers } from "../src/graphql/schema.ts";
import { generate } from "../src/services/assistant.ts";
import type { Context } from "../src/connectionResolvers.ts";
import { csvCell, parseRows } from "../../ui/src/lib/files.ts";

function context(overrides: Record<string, unknown> = {}) {
  return {
    user: { _id: "teacher-1" },
    subdomain: "school-a",
    checkPermission: async () => {},
    models: {},
    ...overrides,
  } as unknown as Context;
}

test("anonymous and tenantless requests never reach a model or provider", async () => {
  for (const ctx of [context({ user: null }), context({ subdomain: "" })]) {
    await assert.rejects(() =>
      resolvers.Mutation.edusmartGenerate(null, { input: { kind: "voice", text: "facts" } }, ctx),
    );
    await assert.rejects(() => resolvers.Query.edusmartWorks(null, { kind: "voice" }, ctx));
    await assert.rejects(() =>
      resolvers.Mutation.edusmartSaveWork(
        null,
        { kind: "voice", title: "title", content: "facts" },
        ctx,
      ),
    );
  }
});

test("permission denial prevents every workspace operation", async () => {
  const ctx = context({
    checkPermission: async () => {
      throw new Error("denied");
    },
  });
  await assert.rejects(() => resolvers.Query.edusmartWorks(null, { kind: "voice" }, ctx), /denied/);
  await assert.rejects(
    () => resolvers.Mutation.edusmartGenerate(null, { input: {} }, ctx),
    /denied/,
  );
  await assert.rejects(
    () =>
      resolvers.Mutation.edusmartSaveWork(
        null,
        { kind: "voice", title: "title", content: "facts" },
        ctx,
      ),
    /denied/,
  );
});

test("history restricts author and kind and applies bounded database pagination", async () => {
  let filter: unknown;
  let page: unknown;
  const chain = {
    sort: () => chain,
    skip: (offset: number) => {
      page = offset;
      return chain;
    },
    limit: (limit: number) => {
      assert.equal(limit, 10);
      return chain;
    },
    lean: async () => [{ _id: "work-1", createdAt: new Date("2026-10-24T00:00:00Z") }],
  };
  const ctx = context({
    models: {
      Workspace: {
        find: (value: unknown) => {
          filter = value;
          return chain;
        },
      },
    },
  });
  const result = await resolvers.Query.edusmartWorks(
    null,
    { kind: "voice", limit: 10, offset: 20 },
    ctx,
  );
  assert.deepEqual(filter, { kind: "voice", createdBy: "teacher-1" });
  assert.equal(page, 20);
  assert.equal(result[0]?.createdAt, "2026-10-24T00:00:00.000Z");
  for (const args of [
    { kind: "voice", limit: 1000 },
    { kind: "voice", offset: -1 },
    { kind: "voice", offset: 10001 },
    { kind: "invalid" },
  ])
    await assert.rejects(() => resolvers.Query.edusmartWorks(null, args, ctx));
});

test("save uses the authenticated author and rejects malformed OCR", async () => {
  let saved: unknown;
  const ctx = context({
    models: {
      Workspace: {
        create: async (value: unknown) => {
          saved = value;
          return { _id: "work-1", createdAt: new Date(), toObject: () => value };
        },
      },
    },
  });
  await resolvers.Mutation.edusmartSaveWork(
    null,
    { kind: "voice", title: " title ", content: " facts " },
    ctx,
  );
  assert.deepEqual(saved, {
    kind: "voice",
    title: "title",
    content: "facts",
    createdBy: "teacher-1",
  });
  await assert.rejects(() =>
    resolvers.Mutation.edusmartSaveWork(
      null,
      { kind: "ocr", title: "title", content: '[{"score":999}]' },
      ctx,
    ),
  );
});

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
