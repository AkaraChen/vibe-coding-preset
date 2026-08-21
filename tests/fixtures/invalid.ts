async function loadName(): Promise<string> {
  return "Ada";
}

loadName();

const leaked: any = JSON.parse("{}");
leaked.run();
