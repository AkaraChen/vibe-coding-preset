"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FC, type FormEvent } from "react";
import { ApiError } from "../../shared/api/client";
import { formValue } from "../../shared/ui/form-value";
import { LoadingState } from "../../shared/ui/states";
import { uploadAttachment } from "../attachments/requests";
import { commentListQueryOptions, createComment } from "../comments/requests";
import { projectListQueryOptions } from "../projects/requests";
import { workspaceListQueryOptions } from "../workspaces/requests";
import {
  createTask,
  taskDetailQueryOptions,
  taskListQueryOptions,
  type TaskFilters,
} from "./requests";
import { TaskListView } from "./task-list-view";
import { TaskStatusChip } from "./task-status-chip";

function useWorkspaceProject(workspaceSlug: string, projectSlug: string) {
  const list = useQuery(workspaceListQueryOptions());
  const workspace = list.data?.items.find(
    (item) => item.workspace.slug === workspaceSlug,
  );
  const projects = useQuery({
    ...projectListQueryOptions(workspace?.workspace.id ?? ""),
    enabled: workspace !== undefined,
  });
  const project = projects.data?.items.find(
    (item) => item.slug === projectSlug,
  );
  return {
    list,
    project,
    role: workspace?.role,
    workspace: workspace?.workspace,
  };
}

export const TaskListPage: FC<{
  projectSlug: string;
  workspaceSlug: string;
}> = ({ projectSlug, workspaceSlug }) => {
  const params = useSearchParams();
  const filters: TaskFilters = {
    assignee: params.get("assignee"),
    q: params.get("q"),
    status: params.get("status"),
  };
  const ctx = useWorkspaceProject(workspaceSlug, projectSlug);
  const tasks = useQuery({
    ...taskListQueryOptions(ctx.project?.id ?? "", filters),
    enabled: ctx.project !== undefined,
  });
  const forbidden =
    tasks.error instanceof ApiError && tasks.error.status === 403;
  return (
    <section className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <label>
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="ml-1 rounded border px-2 py-1"
          >
            <option value="">any</option>
            <option value="todo">todo</option>
            <option value="in_progress">in progress</option>
            <option value="blocked">blocked</option>
            <option value="done">done</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        <label>
          Search
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            className="ml-1 rounded border px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded border px-3 py-1">
          Filter
        </button>
        <a
          className="underline"
          href={`/w/${workspaceSlug}/p/${projectSlug}/tasks/new`}
        >
          New task
        </a>
      </form>
      <div className="mt-4">
        <TaskListView
          error={tasks.isError && !forbidden}
          forbidden={forbidden}
          items={tasks.data?.items ?? []}
          loading={ctx.list.isPending || tasks.isPending}
          onRetry={() => void tasks.refetch()}
          projectSlug={projectSlug}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </section>
  );
};

export const NewTaskPage: FC<{
  projectSlug: string;
  workspaceSlug: string;
}> = ({ projectSlug, workspaceSlug }) => {
  const router = useRouter();
  const ctx = useWorkspaceProject(workspaceSlug, projectSlug);
  const create = useMutation({
    mutationFn: (input: { status?: string; title: string }) =>
      createTask(ctx.project?.id ?? "", input),
    onSuccess: (result) => {
      router.push(
        `/w/${workspaceSlug}/p/${projectSlug}/tasks/${result.task.id}`,
      );
    },
  });
  const viewer = ctx.role === "viewer";
  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (viewer) {
      return;
    }
    const form = new FormData(event.currentTarget);
    create.mutate({
      status: formValue(form, "status"),
      title: formValue(form, "title"),
    });
  }
  if (ctx.list.isPending) {
    return <LoadingState />;
  }
  return (
    <section className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-semibold">New task</h1>
      {viewer ? (
        <p data-testid="forbidden-state">Viewers cannot create tasks.</p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block">
          Title
          <input
            name="title"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            disabled={viewer}
          />
        </label>
        <label className="block">
          Status
          <select
            name="status"
            className="mt-1 w-full rounded border px-3 py-2"
            defaultValue="todo"
            disabled={viewer}
          >
            <option value="todo">todo</option>
            <option value="in_progress">in progress</option>
            <option value="blocked">blocked</option>
            <option value="done">done</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-2 text-white"
          disabled={viewer}
        >
          Create task
        </button>
      </form>
    </section>
  );
};

export const TaskDetailPage: FC<{
  projectSlug: string;
  taskId: string;
  workspaceSlug: string;
}> = ({ projectSlug, taskId, workspaceSlug }) => {
  const ctx = useWorkspaceProject(workspaceSlug, projectSlug);
  const detail = useQuery(taskDetailQueryOptions(taskId));
  const comments = useQuery(commentListQueryOptions(taskId));
  const comment = useMutation({
    mutationFn: (body: string) => createComment(taskId, body),
    onSuccess: async () => {
      await comments.refetch();
    },
  });
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const viewer = ctx.role === "viewer";
  if (detail.isPending) {
    return <LoadingState />;
  }
  if (detail.isError) {
    return <p data-testid="error-state">Task not found.</p>;
  }
  const task = detail.data.task;
  return (
    <section className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">{task.title}</h1>
      <p className="mt-2 text-neutral-700">
        {task.description || "No description"}
      </p>
      <div className="mt-4">
        <TaskStatusChip task={task} disabled={viewer} />
      </div>
      <h2 className="mt-8 font-medium">Comments</h2>
      <ul className="mt-2 space-y-2">
        {(comments.data?.items ?? []).map((item) => (
          <li key={item.id}>{item.body}</li>
        ))}
      </ul>
      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (viewer) {
            return;
          }
          const form = new FormData(event.currentTarget);
          comment.mutate(formValue(form, "body"));
          event.currentTarget.reset();
        }}
      >
        <label className="block">
          Comment
          <textarea
            name="body"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            disabled={viewer}
          />
        </label>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-2 text-white"
          disabled={viewer}
        >
          Add comment
        </button>
      </form>
      <form
        className="mt-6 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (viewer) {
            return;
          }
          const form = new FormData(event.currentTarget);
          const file = form.get("file");
          if (file instanceof File && file.size > 0) {
            setUploadError(undefined);
            uploadAttachment(taskId, file).then(
              () => {
                setUploadError(undefined);
              },
              () => {
                setUploadError("Could not upload the file.");
              },
            );
          }
        }}
      >
        {uploadError ? (
          <p data-testid="error-state" role="alert" className="text-red-700">
            {uploadError}
          </p>
        ) : null}
        <label className="block">
          Attachment
          <input
            name="file"
            type="file"
            className="mt-1 block"
            disabled={viewer}
          />
        </label>
        <button
          type="submit"
          className="rounded border px-3 py-2"
          disabled={viewer}
        >
          Upload
        </button>
      </form>
    </section>
  );
};
