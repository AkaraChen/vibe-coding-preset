"use client";

import { useRouter } from "next/navigation";
import { useState, type FC, type FormEvent } from "react";
import { ApiError } from "../../shared/api/client";
import { formValue } from "../../shared/ui/form-value";
import { registerRequest } from "./requests";

export const RegisterForm: FC = () => {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await registerRequest({
        email: formValue(form, "email"),
        name: formValue(form, "name"),
        password: formValue(form, "password"),
      });
      router.push("/w");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Register failed");
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mx-auto mt-16 max-w-sm space-y-4 p-4"
    >
      <h1 className="text-xl font-semibold">Register</h1>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
      <label className="block">
        Name
        <input
          name="name"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        Password
        <input
          name="password"
          type="password"
          minLength={10}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded bg-neutral-900 px-3 py-2 text-white"
      >
        Create account
      </button>
    </form>
  );
};
