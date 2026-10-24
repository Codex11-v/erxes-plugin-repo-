import { Schema, type Model } from "mongoose";

export interface WorkspaceRecord {
  kind: "voice" | "lessons" | "ocr";
  title: string;
  content: string;
  createdBy: string;
  createdAt: Date;
}

export type WorkspaceModel = Model<WorkspaceRecord>;
export const workspaceSchema = new Schema<WorkspaceRecord>({
  kind: { type: String, enum: ["voice", "lessons", "ocr"], required: true },
  title: { type: String, required: true, maxlength: 200 },
  content: { type: String, required: true, maxlength: 100000 },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
workspaceSchema.index({ createdBy: 1, kind: 1, createdAt: -1, _id: -1 });
