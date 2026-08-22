import type { FC } from "react";
import { NewProjectPage } from "../../../../../src/features/projects/project-pages";

type PageProps = { params: Promise<{ workspaceSlug: string }> };

const Page: FC<PageProps> = async ({ params }) => {
  const { workspaceSlug } = await params;
  return <NewProjectPage slug={workspaceSlug} />;
};

export default Page;
