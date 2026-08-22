import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./constants.ts";
import { TASK_PRIORITIES, TASK_STATUSES } from "./status.ts";
import { WORKSPACE_ROLES } from "./rbac.ts";

export const emailSchema = z.email().trim().toLowerCase();
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const uuidSchema = z.uuid();

export const registerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(80),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
});

export const workspacePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  slug: slugSchema.optional(),
});

export const memberInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["viewer", "member", "admin"]),
});

export const memberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES),
});

export const ownerTransferSchema = z.object({
  userId: uuidSchema,
});

export const projectCreateSchema = z.object({
  description: z.string().max(4000).optional(),
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
});

export const projectPatchSchema = z.object({
  description: z.string().max(4000).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  slug: slugSchema.optional(),
});

export const taskCreateSchema = z.object({
  assigneeId: uuidSchema.nullable().optional(),
  description: z.string().max(8000).optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  title: z.string().trim().min(1).max(200),
});

export const taskPatchSchema = z.object({
  assigneeId: uuidSchema.nullable().optional(),
  description: z.string().max(8000).optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  version: z.number().int().positive(),
});

export const bulkStatusSchema = z.object({
  ids: z.array(uuidSchema).min(1),
  status: z.enum(TASK_STATUSES),
});

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});
