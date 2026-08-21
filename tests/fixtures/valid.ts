export async function loadName(): Promise<string> {
  return Promise.resolve("Ada");
}

export async function normalizedName(): Promise<string> {
  const name = await loadName();
  return name.trim();
}
