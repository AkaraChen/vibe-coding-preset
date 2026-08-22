"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FC, type FormEvent } from "react";
import { ApiError } from "../../shared/api/client";
import { formValue } from "../../shared/ui/form-value";
import { loginRequest } from "./requests";

export const LoginForm: FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | undefined>(undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = formValue(form, "email");
    const password = formValue(form, "password");
    try {
      await loginRequest({ email, password });
      const next = params.get("next") ?? "/w";
      router.push(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Login failed");
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mx-auto mt-16 max-w-sm space-y-4 p-4"
    >
      <h1 className="text-xl font-semibold">Log in</h1>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
      <label className="block">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded bg-neutral-900 px-3 py-2 text-white"
      >
        Log in
      </button>
      <p>
        Need an account?{" "}
        <a href="/register" className="underline">
          Register
        </a>
      </p>
    </form>
  );
};
