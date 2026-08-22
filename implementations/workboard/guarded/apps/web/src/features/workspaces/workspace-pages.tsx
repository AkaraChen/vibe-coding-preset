"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FC, FormEvent } from "react";
import { ApiError } from "../../shared/api/client";
import { formValue } from "../../shared/ui/form-value";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "../../shared/ui/states";
import { activityListQueryOptions } from "../activities/requests";
import { projectListQueryOptions } from "../projects/requests";
import {
  createWorkspace,
  inviteMember,
  membersQueryOptions,
  workspaceListQueryOptions,
} from "./requests";

export const WorkspaceListPage: FC = () => {
  const query = useQuery(workspaceListQueryOptions());
  const router = useRouter();
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["workspaces"] });
      router.push(`/w/${result.workspace.slug}`);
    },
  });

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      name: formValue(form, "name"),
      slug: formValue(form, "slug"),
    });
  }

  if (query.isPending) {
    return <LoadingState />;
  }
  if (query.isError) {
    return query.error instanceof ApiError && query.error.status === 403 ? (
      <ForbiddenState />
    ) : (
      <ErrorState
        onRetry={() => {
          query.refetch().then(
            () => undefined,
            () => undefined,
          );
        }}
      />
    );
  }
  const items = query.data.items;
  return (
    <section className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      {items.length === 0 ? (
        <EmptyState message="Create a workspace to get started." />
      ) : null}
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.workspace.id}>
            <a className="underline" href={`/w/${item.workspace.slug}`}>
              {item.workspace.name}
            </a>
            <span className="ml-2 text-sm text-neutral-600">{item.role}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={onCreate} className="mt-8 space-y-3">
        <h2 className="font-medium">New workspace</h2>
        <label className="block">
          Name
          <input
            name="name"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          Slug
          <input
            name="slug"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-2 text-white"
        >
          Create
        </button>
      </form>
    </section>
  );
};

export const WorkspaceOverview: FC<{ slug: string }> = ({ slug }) => {
  const list = useQuery(workspaceListQueryOptions());
  const workspace = list.data?.items.find(
    (item) => item.workspace.slug === slug,
  )?.workspace;
  const projects = useQuery({
    ...projectListQueryOptions(workspace?.id ?? ""),
    enabled: workspace !== undefined,
  });
  if (list.isPending || projects.isPending) {
    return <LoadingState />;
  }
  if (list.isError || workspace === undefined) {
    return <ErrorState />;
  }
  const items = projects.data?.items ?? [];
  return (
    <section className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">{workspace.name}</h1>
      <nav className="mt-2 flex gap-4 text-sm">
        <a className="underline" href={`/w/${slug}/settings/members`}>
          Members
        </a>
        <a className="underline" href={`/w/${slug}/projects/new`}>
          New project
        </a>
        <a className="underline" href={`/w/${slug}/activity`}>
          Activity
        </a>
      </nav>
      {items.length === 0 ? <EmptyState message="No projects yet." /> : null}
      <ul className="mt-4 space-y-2">
        {items.map((project) => (
          <li key={project.id}>
            <a
              className="underline"
              href={`/w/${slug}/p/${project.slug}/tasks`}
            >
              {project.name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const MembersPage: FC<{ slug: string }> = ({ slug }) => {
  const list = useQuery(workspaceListQueryOptions());
  const workspace = list.data?.items.find(
    (item) => item.workspace.slug === slug,
  );
  const members = useQuery({
    ...membersQueryOptions(workspace?.workspace.id ?? ""),
    enabled: workspace !== undefined,
  });
  const invite = useMutation({
    mutationFn: (input: {
      email: string;
      role: "viewer" | "member" | "admin";
    }) => inviteMember(workspace?.workspace.id ?? "", input),
    onSuccess: async () => {
      await members.refetch();
    },
  });
  if (list.isPending || members.isPending) {
    return <LoadingState />;
  }
  if (workspace === undefined) {
    return <ErrorState />;
  }
  const canInvite = workspace.role === "admin" || workspace.role === "owner";
  return (
    <section className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Members</h1>
      <ul className="mt-4 space-y-2">
        {(members.data?.items ?? []).map((member) => (
          <li key={member.userId}>
            {member.name} ({member.email}) — {member.role}
          </li>
        ))}
      </ul>
      {canInvite ? (
        <form
          className="mt-8 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            invite.mutate({
              email: formValue(form, "email"),
              role: formValue(form, "role") as "viewer" | "member" | "admin",
            });
          }}
        >
          <label className="block">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            Role
            <select
              name="role"
              className="mt-1 w-full rounded border px-3 py-2"
              defaultValue="member"
            >
              <option value="viewer">viewer</option>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-2 text-white"
          >
            Invite
          </button>
        </form>
      ) : null}
    </section>
  );
};

export const ActivityPage: FC<{ slug: string }> = ({ slug }) => {
  const list = useQuery(workspaceListQueryOptions());
  const workspace = list.data?.items.find(
    (item) => item.workspace.slug === slug,
  )?.workspace;
  const query = useQuery({
    ...activityListQueryOptions(workspace?.id ?? ""),
    enabled: workspace !== undefined,
  });
  if (query.isPending || list.isPending) {
    return <LoadingState />;
  }
  if (query.isError) {
    return <ErrorState />;
  }
  const items = query.data.items;
  return (
    <section className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Activity</h1>
      {items.length === 0 ? <EmptyState /> : null}
      <ol className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} data-testid={`activity-${item.type}`}>
            {item.type}
          </li>
        ))}
      </ol>
    </section>
  );
};
