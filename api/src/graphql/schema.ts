import { gql } from "graphql-tag";
import { GraphQLError } from "graphql";
import { manifest } from "../config.ts";
import type { Context } from "../connectionResolvers.ts";
import { SAMPLE_READ, WORKSPACE_READ, WORKSPACE_WRITE, AI_GENERATE } from "../permissions.ts";
import { generate, gradeRows } from "../services/assistant.ts";
import { z } from "zod";

const kindSchema = z.enum(["voice", "lessons", "ocr"]);

async function authorize(context: Context, action: string) {
  if (!context.user?._id)
    throw new GraphQLError("Please sign in.", { extensions: { code: "UNAUTHENTICATED" } });
  if (!context.subdomain)
    throw new GraphQLError("Tenant required", { extensions: { code: "FORBIDDEN" } });
  await context.checkPermission(action);
  return context.user._id;
}
// Every type and operation is prefixed with the plugin name: the gateway
// composes all plugins into one supergraph, so names must be unique across it.
export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

  type EdusmartStatus {
    plugin: String!
    version: String!
    subdomain: String!
    userId: String
    userEmail: String
    aiReady: Boolean!
  }

  type EdusmartSample {
    _id: String!
    label: String!
    createdAt: String
  }

  type Query {
    edusmartWorks(kind: String!, limit: Int = 10, offset: Int = 0): [EdusmartWork!]!
    edusmartStatus: EdusmartStatus!
    edusmartSamples(limit: Int = 20, offset: Int = 0): [EdusmartSample!]!
  }
  type EdusmartWork {
    _id: String!
    kind: String!
    title: String!
    content: String!
    createdAt: String!
  }
  input EdusmartAssistantInput {
    kind: String!
    text: String
    subject: String
    grade: String
    duration: Int
    topic: String
    instructions: String
    teacher: String
    className: String
    date: String
    file: String
    mimeType: String
  }
  type Mutation {
    edusmartGenerate(input: EdusmartAssistantInput!): String!
    edusmartSaveWork(kind: String!, title: String!, content: String!): EdusmartWork!
  }
`;

export const resolvers = {
  Query: {
    edusmartWorks: async (
      _parent: unknown,
      { kind, limit = 10, offset = 0 }: { kind: string; limit?: number; offset?: number },
      context: Context,
    ) => {
      const createdBy = await authorize(context, WORKSPACE_READ);
      if (
        !kindSchema.safeParse(kind).success ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 10000
      ) {
        throw new GraphQLError("Invalid page or tool", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const records = await context.models.Workspace.find({ kind, createdBy })
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .lean();
      return records.map((record) => ({
        ...record,
        _id: record._id.toString(),
        createdAt: record.createdAt.toISOString(),
      }));
    },
    edusmartStatus: (_parent: unknown, _args: unknown, { subdomain, user }: Context) => ({
      plugin: manifest.name,
      version: manifest.version,
      subdomain,
      userId: user?._id ?? null,
      userEmail: user?.email ?? null,
      aiReady: Boolean(
        process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
      ),
    }),
    edusmartSamples: async (
      _parent: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number },
      { models, user, subdomain, checkPermission }: Context,
    ) => {
      if (!user?._id) {
        throw new GraphQLError("Login required", { extensions: { code: "UNAUTHENTICATED" } });
      }
      if (!subdomain) {
        throw new GraphQLError("Tenant required", { extensions: { code: "FORBIDDEN" } });
      }
      await checkPermission(SAMPLE_READ);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 10_000
      ) {
        throw new GraphQLError("Use limit 1–100 and offset 0–10000", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return (await models.Samples.list({ limit, offset })).map((sample) => ({
        ...sample,
        createdAt: sample.createdAt?.toISOString?.() ?? null,
      }));
    },
  },
  Mutation: {
    edusmartGenerate: async (
      _parent: unknown,
      { input }: { input: Record<string, unknown> },
      context: Context,
    ) => {
      await authorize(context, AI_GENERATE);
      return generate(
        Object.fromEntries(Object.entries(input).filter(([, value]) => value != null)),
      );
    },
    edusmartSaveWork: async (
      _parent: unknown,
      args: { kind: string; title: string; content: string },
      context: Context,
    ) => {
      const createdBy = await authorize(context, WORKSPACE_WRITE);
      const parsed = z
        .object({
          kind: kindSchema,
          title: z.string().trim().min(1).max(200),
          content: z.string().trim().min(1).max(100000),
        })
        .safeParse(args);
      if (!parsed.success) {
        throw new GraphQLError("Check the title and content.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (parsed.data.kind === "ocr") {
        try {
          gradeRows.parse(JSON.parse(parsed.data.content));
        } catch {
          throw new GraphQLError("The table data is invalid.", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
      }
      const record = await context.models.Workspace.create({ ...parsed.data, createdBy });
      return {
        ...record.toObject(),
        _id: record._id.toString(),
        createdAt: record.createdAt.toISOString(),
      };
    },
  },
};
