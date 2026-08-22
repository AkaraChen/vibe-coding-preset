"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { FC, FormEvent } from "react";
import { formValue } from "../../shared/ui/form-value";
import { LoadingState } from "../../shared/ui/states";
import { workspaceListQueryOptions } from "../workspaces/requests";
import { createProject } from "./requests";

export const NewProjectPage: FC<{ slug: string }> = ({ slug }) => {
  const router = useRouter();
  const list = useQuery(workspaceListQueryOptions());
  const workspace = list.data?.items.find(
    (item) => item.workspace.slug === slug,
  );
  const create = useMutation({
    mutationFn: (input: { name: string; slug: string }) =>
      createProject(workspace?.workspace.id ?? "", input),
    onSuccess: (result) => {
      router.push(`/w/${slug}/p/${result.project.slug}/tasks`);
    },
  });
  if (list.isPending || workspace === undefined) {
    return <LoadingState />;
  }
  const canCreate = workspace.role === "admin" || workspace.role === "owner";
  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      name: formValue(form, "name"),
      slug: formValue(form, "slug"),
    });
  }
  return (
    <section className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-semibold">New project</h1>
      {canCreate ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
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
            Create project
          </button>
        </form>
      ) : (
        <p data-testid="forbidden-state">You cannot create projects.</p>
      )}
    </section>
  );
};
