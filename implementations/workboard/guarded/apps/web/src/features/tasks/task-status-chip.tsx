"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FC } from "react";
import {
  TASK_STATUSES,
  canTransition,
  type TaskStatus,
} from "@workboard/shared";
import { ApiError } from "../../shared/api/client";
import { ConflictBanner } from "../../shared/ui/states";
import { patchTask, taskKeys, type Task } from "./requests";

type TaskStatusChipProps = {
  disabled?: boolean;
  task: Task;
};

export const TaskStatusChip: FC<TaskStatusChipProps> = ({
  disabled = false,
  task,
}) => {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState(false);
  const mutation = useMutation({
    mutationFn: async (status: TaskStatus) =>
      patchTask(task.id, { status, version: task.version }),
    onError: (error: unknown, _status, previous) => {
      if (previous !== undefined) {
        queryClient.setQueryData(taskKeys.detail(task.id), previous);
      }
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
      }
    },
    onMutate: async (status) => {
      setConflict(false);
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(task.id) });
      const previous = queryClient.getQueryData(taskKeys.detail(task.id));
      queryClient.setQueryData(taskKeys.detail(task.id), {
        task: { ...task, status },
      });
      return previous;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskKeys.all() });
    },
    retry: false,
  });

  const current = task.status as TaskStatus;

  return (
    <div>
      {conflict ? (
        <ConflictBanner
          onReload={() => {
            setConflict(false);
            queryClient
              .invalidateQueries({ queryKey: taskKeys.detail(task.id) })
              .then(
                () => undefined,
                () => undefined,
              );
          }}
        />
      ) : null}
      <label className="text-sm">
        Status
        <select
          aria-label="Task status"
          className="ml-2 rounded border px-2 py-1"
          disabled={disabled || mutation.isPending}
          value={task.status}
          onChange={(event) => {
            const next = event.target.value as TaskStatus;
            if (canTransition(current, next)) {
              mutation.mutate(next);
            }
          }}
        >
          {TASK_STATUSES.map((status) => (
            <option
              key={status}
              value={status}
              disabled={!canTransition(current, status) && status !== current}
            >
              {status.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
