declare function useValue(): string;

export function Greeting(): string {
  const value = useValue();
  return value;
}
