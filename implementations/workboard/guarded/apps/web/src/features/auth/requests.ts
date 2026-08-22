import { queryOptions } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export type User = { email: string; id: string; name: string };

export const queryKeys = {
  session: {
    all: () => ["session"] as const,
    me: () => ["session", "me"] as const,
  },
};

export function meQueryOptions() {
  return queryOptions({
    queryFn: async () => api<{ user: User }>("/api/auth/me"),
    queryKey: queryKeys.session.me(),
    retry: false,
    staleTime: 30_000,
  });
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<{ user: User }> {
  return api("/api/auth/login", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function registerRequest(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ user: User }> {
  return api("/api/auth/register", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function logoutRequest(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
}
