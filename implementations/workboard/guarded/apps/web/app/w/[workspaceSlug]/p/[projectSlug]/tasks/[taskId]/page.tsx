import type { FC } from "react";
import { TaskDetailPage } from "../../../../../../../src/features/tasks/task-pages";

type PageProps = {
  params: Promise<{
    projectSlug: string;
    taskId: string;
    workspaceSlug: string;
  }>;
};

const Page: FC<PageProps> = async ({ params }) => {
  const { projectSlug, taskId, workspaceSlug } = await params;
  return (
    <TaskDetailPage
      projectSlug={projectSlug}
      taskId={taskId}
      workspaceSlug={workspaceSlug}
    />
  );
};

export default Page;
