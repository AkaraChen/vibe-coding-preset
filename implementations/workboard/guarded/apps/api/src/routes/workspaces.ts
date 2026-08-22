import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { users, workspaceMembers, workspaces } from "@workboard/db";
import {
  AppError,
  ERROR_CODES,
  canChangeMemberRole,
  canRemoveMember,
  conflict,
  forbidden,
  isWorkspaceRole,
  memberInviteSchema,
  memberRoleSchema,
  notFound,
  ownerTransferSchema,
  unprocessable,
  workspaceCreateSchema,
  workspacePatchSchema,
  type WorkspaceRole,
} from "@workboard/shared";
import { recordActivity } from "../activity.ts";
import { loadWorkspace, requirePermission } from "../access.ts";
import { parseJson, requireActor } from "../http.ts";
import type { AppDeps, AppVariables } from "../types.ts";

export function mountWorkspaces(
  app: Hono<{ Variables: AppVariables }>,
  deps: AppDeps,
): void {
  app.get("/api/workspaces", async (c) => {
    const actor = requireActor(c);
    const items = await deps.db
      .select({ role: workspaceMembers.role, workspace: workspaces })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, actor.id));
    return c.json({
      items: items.map((item) => ({
        role: item.role,
        workspace: item.workspace,
      })),
    });
  });

  app.post("/api/workspaces", async (c) => {
    const actor = requireActor(c);
    const body = await parseJson(c, workspaceCreateSchema);
    const created = await deps.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(workspaces)
        .values({ name: body.name, slug: body.slug })
        .returning();
      const workspace = inserted[0];
      if (workspace === undefined) {
        throw new AppError(
          500,
          ERROR_CODES.internal,
          "Failed to create workspace",
        );
      }
      await tx.insert(workspaceMembers).values({
        role: "owner",
        userId: actor.id,
        workspaceId: workspace.id,
      });
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: workspace.id,
        entityType: "workspace",
        type: "workspace.created",
        workspaceId: workspace.id,
      });
      return workspace;
    });
    return c.json({ workspace: created }, 201);
  });

  app.get("/api/workspaces/:workspaceId", async (c) => {
    const actor = requireActor(c);
    const { workspace, membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "workspace.read");
    return c.json({ role: membership.role, workspace });
  });

  app.patch("/api/workspaces/:workspaceId", async (c) => {
    const actor = requireActor(c);
    const { workspace, membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "workspace.update");
    const body = await parseJson(c, workspacePatchSchema);
    const updated = await deps.db
      .update(workspaces)
      .set({
        name: body.name ?? workspace.name,
        slug: body.slug ?? workspace.slug,
        updatedAt: deps.now(),
      })
      .where(eq(workspaces.id, workspace.id))
      .returning();
    return c.json({ workspace: updated[0] });
  });

  app.delete("/api/workspaces/:workspaceId", async (c) => {
    const actor = requireActor(c);
    const { workspace, membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "workspace.delete");
    await deps.db.delete(workspaces).where(eq(workspaces.id, workspace.id));
    return c.body(null, 204);
  });

  app.get("/api/workspaces/:workspaceId/members", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "member.read");
    const items = await deps.db
      .select({
        createdAt: workspaceMembers.createdAt,
        email: users.email,
        name: users.name,
        role: workspaceMembers.role,
        userId: users.id,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, membership.workspaceId));
    return c.json({ items });
  });

  app.post("/api/workspaces/:workspaceId/members", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "member.invite");
    const body = await parseJson(c, memberInviteSchema);
    const invitees = await deps.db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    const invitee = invitees[0];
    if (invitee === undefined) {
      throw notFound("User not found");
    }
    try {
      await deps.db.transaction(async (tx) => {
        await tx.insert(workspaceMembers).values({
          role: body.role,
          userId: invitee.id,
          workspaceId: membership.workspaceId,
        });
        await recordActivity(tx, {
          actorId: actor.id,
          entityId: invitee.id,
          entityType: "member",
          payload: { role: body.role },
          type: "member.added",
          workspaceId: membership.workspaceId,
        });
      });
    } catch {
      throw conflict(ERROR_CODES.alreadyMember, "Already a member");
    }
    return c.json({ role: body.role, userId: invitee.id }, 201);
  });

  app.patch("/api/workspaces/:workspaceId/members/:userId", async (c) => {
    const actor = requireActor(c);
    const userId = c.req.param("userId");
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "member.update");
    const body = await parseJson(c, memberRoleSchema);
    if (!isWorkspaceRole(body.role)) {
      throw unprocessable(ERROR_CODES.validation, "Invalid role");
    }
    const targetRows = await deps.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, membership.workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    const target = targetRows[0];
    if (target === undefined) {
      throw notFound();
    }
    const targetRole = target.role as WorkspaceRole;
    if (!canChangeMemberRole(membership.role, targetRole, body.role)) {
      throw forbidden();
    }
    await deps.db.transaction(async (tx) => {
      await tx
        .update(workspaceMembers)
        .set({ role: body.role })
        .where(
          and(
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        );
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: userId,
        entityType: "member",
        payload: { role: body.role },
        type: "member.role_changed",
        workspaceId: membership.workspaceId,
      });
    });
    return c.json({ role: body.role, userId });
  });

  app.delete("/api/workspaces/:workspaceId/members/:userId", async (c) => {
    const actor = requireActor(c);
    const userId = c.req.param("userId");
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "member.remove");
    const targetRows = await deps.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, membership.workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    const target = targetRows[0];
    if (target === undefined) {
      throw notFound();
    }
    if (!canRemoveMember(membership.role, target.role as WorkspaceRole)) {
      throw conflict(
        ERROR_CODES.ownerTransferRequired,
        "Cannot remove the owner",
      );
    }
    await deps.db.transaction(async (tx) => {
      await tx
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        );
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: userId,
        entityType: "member",
        type: "member.removed",
        workspaceId: membership.workspaceId,
      });
    });
    return c.body(null, 204);
  });

  app.post("/api/workspaces/:workspaceId/owner", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "owner.transfer");
    const body = await parseJson(c, ownerTransferSchema);
    const targetRows = await deps.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, membership.workspaceId),
          eq(workspaceMembers.userId, body.userId),
        ),
      )
      .limit(1);
    if (targetRows[0] === undefined) {
      throw notFound();
    }
    await deps.db.transaction(async (tx) => {
      await tx
        .update(workspaceMembers)
        .set({ role: "admin" })
        .where(
          and(
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            eq(workspaceMembers.userId, actor.id),
          ),
        );
      await tx
        .update(workspaceMembers)
        .set({ role: "owner" })
        .where(
          and(
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            eq(workspaceMembers.userId, body.userId),
          ),
        );
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: body.userId,
        entityType: "member",
        type: "member.role_changed",
        workspaceId: membership.workspaceId,
      });
    });
    return c.json({ ownerId: body.userId });
  });
}
