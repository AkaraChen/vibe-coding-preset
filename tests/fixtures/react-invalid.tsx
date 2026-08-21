declare function useValue(): string;

export function Greeting({ enabled }: { enabled: boolean }): string {
  if (enabled) {
    return useValue();
  }

  return "disabled";
}
