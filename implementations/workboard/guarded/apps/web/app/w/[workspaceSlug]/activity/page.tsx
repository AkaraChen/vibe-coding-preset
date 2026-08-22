import type { FC } from "react";
import { ActivityPage } from "../../../../src/features/workspaces/workspace-pages";

type PageProps = { params: Promise<{ workspaceSlug: string }> };

const Page: FC<PageProps> = async ({ params }) => {
  const { workspaceSlug } = await params;
  return <ActivityPage slug={workspaceSlug} />;
};

export default Page;
