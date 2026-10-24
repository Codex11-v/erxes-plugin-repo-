import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvers } from "../src/graphql/schema.ts";
import type { Context } from "../src/connectionResolvers.ts";

function context(overrides: Record<string, unknown> = {}) {
  return {
    user: { _id: "teacher-1" },
    subdomain: "school-a",
    checkPermission: async () => {},
    models: {},
    ...overrides,
  } as unknown as Context;
}

test("saved work is private to its author and uses bounded pagination", async () => {
  let filter: unknown;
  let offsetSeen = -1;
  const chain = {
    sort: () => chain,
    skip: (offset: number) => {
      offsetSeen = offset;
      return chain;
    },
    limit: (limit: number) => {
      assert.equal(limit, 10);
      return chain;
    },
    lean: async () => [
      { _id: { toString: () => "saved-1" }, createdAt: new Date("2026-10-24T00:00:00Z") },
    ],
  };
  const ctx = context({
    models: {
      Workspace: {
        find: (query: unknown) => {
          filter = query;
          return chain;
        },
      },
    },
  });

  const records = await resolvers.Query.edusmartWorks(
    null,
    { kind: "voice", limit: 10, offset: 20 },
    ctx,
  );
  assert.deepEqual(filter, { kind: "voice", createdBy: "teacher-1" });
  assert.equal(offsetSeen, 20);
  assert.equal(records[0]?._id, "saved-1");
  assert.equal(records[0]?.createdAt, "2026-10-24T00:00:00.000Z");

  for (const args of [
    { kind: "voice", limit: 1000 },
    { kind: "voice", offset: -1 },
    { kind: "voice", offset: 10001 },
    { kind: "invalid" },
  ]) {
    await assert.rejects(() => resolvers.Query.edusmartWorks(null, args, ctx));
  }
});

test("saved work uses the authenticated author and rejects invalid data", async () => {
  let saved: unknown;
  const ctx = context({
    models: {
      Workspace: {
        create: async (value: unknown) => {
          saved = value;
          return {
            _id: { toString: () => "saved-1" },
            createdAt: new Date("2026-10-24T00:00:00Z"),
            toObject: () => value,
          };
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

test("saved work requires a signed-in user, tenant and the matching permission", async () => {
  const denied = context({
    checkPermission: async () => {
      throw new Error("denied");
    },
  });
  const anonymous = context({ user: null });
  const tenantless = context({ subdomain: "" });

  await assert.rejects(() => resolvers.Query.edusmartWorks(null, { kind: "voice" }, denied), /denied/);
  await assert.rejects(
    () => resolvers.Mutation.edusmartSaveWork(null, { kind: "voice", title: "t", content: "c" }, denied),
    /denied/,
  );
  await assert.rejects(() => resolvers.Query.edusmartWorks(null, { kind: "voice" }, anonymous));
  await assert.rejects(() => resolvers.Mutation.edusmartSaveWork(null, { kind: "voice", title: "t", content: "c" }, tenantless));
});
