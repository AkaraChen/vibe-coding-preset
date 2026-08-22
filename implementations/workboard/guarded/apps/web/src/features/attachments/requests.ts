export async function uploadAttachment(
  taskId: string,
  file: File,
): Promise<{ filename: string; id: string }> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`/api/tasks/${taskId}/attachments`, {
    body,
    credentials: "include",
    method: "POST",
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    throw new Error("Upload failed");
  }
  return json as { filename: string; id: string };
}
