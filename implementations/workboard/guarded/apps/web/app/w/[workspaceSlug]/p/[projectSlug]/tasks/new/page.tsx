import type { FC } from "react";
import { NewTaskPage } from "../../../../../../../src/features/tasks/task-pages";

type PageProps = {
  params: Promise<{ projectSlug: string; workspaceSlug: string }>;
};

const Page: FC<PageProps> = async ({ params }) => {
  const { projectSlug, workspaceSlug } = await params;
  return (
    <NewTaskPage projectSlug={projectSlug} workspaceSlug={workspaceSlug} />
  );
};

export default Page;
