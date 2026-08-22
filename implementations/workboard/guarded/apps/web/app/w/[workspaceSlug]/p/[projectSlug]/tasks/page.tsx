import type { FC } from "react";
import { TaskListPage } from "../../../../../../src/features/tasks/task-pages";

type PageProps = {
  params: Promise<{ projectSlug: string; workspaceSlug: string }>;
};

const Page: FC<PageProps> = async ({ params }) => {
  const { projectSlug, workspaceSlug } = await params;
  return (
    <TaskListPage projectSlug={projectSlug} workspaceSlug={workspaceSlug} />
  );
};

export default Page;
