import type { IPermissionConfig } from "erxes-api-shared/core-types";
import { manifest } from "./config.ts";

// Action names are global across the platform, not local to this plugin.
export const SAMPLE_READ = "edusmartSamplesRead";
export const WORKSPACE_READ = "edusmartWorkspaceRead";
export const WORKSPACE_WRITE = "edusmartWorkspaceWrite";
export const AI_GENERATE = "edusmartAiGenerate";

export const permissions: IPermissionConfig = {
  plugin: manifest.name,
  modules: [
    {
      name: "edusmartWorkspace",
      description: "Personal teacher work saved in EduSmart",
      scopeField: null,
      ownerFields: [],
      scopes: [{ name: "all", description: "Use tools; saved work is restricted to its author" }],
      actions: [
        {
          name: WORKSPACE_READ,
          title: "Read own work",
          description: "View your saved teacher reports, lessons and tables",
        },
        {
          name: WORKSPACE_WRITE,
          title: "Save own work",
          description: "Save teacher work in EduSmart",
        },
      ],
    },
    {
      name: "edusmartTools",
      description: "Generate teacher reports, lesson plans, slides, and tables",
      scopeField: null,
      ownerFields: [],
      scopes: [{ name: "all", description: "Use the EduSmart teacher tools" }],
      actions: [
        {
          name: AI_GENERATE,
          title: "Use AI tools",
          description: "Generate lessons, reports and extract images or audio",
        },
      ],
    },
    {
      name: "edusmartSamples",
      description: `${manifest.title} sample records`,
      scopeField: null,
      ownerFields: [],
      // This example grants tenant-wide reads only; do not advertise own/group
      // scopes unless the model query actually filters for those scopes.
      scopes: [{ name: "all", description: "All sample records in this tenant" }],
      actions: [
        {
          name: SAMPLE_READ,
          title: "Read sample records",
          description: `View ${manifest.title} sample records`,
        },
      ],
    },
  ],
};
