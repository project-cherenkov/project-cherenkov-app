"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { signUp, signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export interface SignupFormProps {
  googleEnabled: boolean;
}

export function SignupForm({ googleEnabled }: SignupFormProps) {
  const t = useTranslations("phase2.signup");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message ?? t("genericError"));
        return;
      }
      router.push("/planner");
    });
  }

  function handleGoogle() {
    // Sign-up and sign-in via Google are the same Better Auth call —
    // signIn.social() creates the account on first use.
    void signIn.social({ provider: "google", callbackURL: `/${locale}/planner` });
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        {t("title")}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("nameLabel")}
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("emailLabel")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("passwordLabel")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {t("submit")}
        </Button>
      </form>

      {googleEnabled ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-center text-xs uppercase tracking-wide text-slate-400">
            {t("orDivider")}
          </p>
          <Button variant="outline" type="button" onClick={handleGoogle}>
            {t("googleButton")}
          </Button>
        </div>
      ) : null}

      <p className="mt-6 text-sm text-slate-600">
        {t("hasAccount")}{" "}
        <Link href="/login" className="underline">
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
