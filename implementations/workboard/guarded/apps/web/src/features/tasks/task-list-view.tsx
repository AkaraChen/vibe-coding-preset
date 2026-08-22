"use client";

import type { FC } from "react";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "../../shared/ui/states";
import type { Task } from "./requests";

type TaskListViewProps = {
  error: boolean;
  forbidden: boolean;
  items: Task[];
  loading: boolean;
  onRetry?: (() => void) | undefined;
  workspaceSlug: string;
  projectSlug: string;
};

export const TaskListView: FC<TaskListViewProps> = ({
  error,
  forbidden,
  items,
  loading,
  onRetry,
  projectSlug,
  workspaceSlug,
}) => {
  if (loading) {
    return <LoadingState />;
  }
  if (forbidden) {
    return <ForbiddenState />;
  }
  if (error) {
    return <ErrorState onRetry={onRetry} />;
  }
  if (items.length === 0) {
    return <EmptyState message="No tasks match these filters." />;
  }
  return (
    <ul className="divide-y">
      {items.map((task) => (
        <li key={task.id} className="py-3">
          <a
            className="underline"
            href={`/w/${workspaceSlug}/p/${projectSlug}/tasks/${task.id}`}
          >
            {task.title}
          </a>
          <span className="ml-2 text-sm text-neutral-600">
            {task.status.replace("_", " ")}
          </span>
        </li>
      ))}
    </ul>
  );
};
