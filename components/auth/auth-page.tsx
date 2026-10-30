"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";

export function AuthPage({
  defaultTab,
  googleEnabled = false,
  resetEnabled = false,
}: {
  defaultTab: "login" | "signup";
  googleEnabled?: boolean;
  resetEnabled?: boolean;
}) {
  const t = useTranslations("phase2");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLogin = defaultTab === "login";

  function switchTab(value: string) {
    const target = value === "login" ? "/login" : "/signup";
    const next = searchParams.get("next");
    router.replace(next ? `${target}?next=${encodeURIComponent(next)}` : target);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:py-16">
      <div className="order-1 rounded-lg border border-border bg-card">
        <Tabs
          value={isLogin ? "login" : "signup"}
          onValueChange={switchTab}
          className="p-5 sm:p-7"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t("login.title")}</TabsTrigger>
            <TabsTrigger value="signup">{t("signup.title")}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm googleEnabled={googleEnabled} resetEnabled={resetEnabled} />
          </TabsContent>
          <TabsContent value="signup">
            <SignupForm googleEnabled={googleEnabled} />
          </TabsContent>
        </Tabs>
      </div>
      <aside className="order-2 rounded-lg border border-border bg-muted/40 p-6 sm:p-8">
        <p className="label-code">{t("benefits.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t("benefits.title")}</h1>
        <p className="mt-3 text-foreground/75">{t("benefits.body")}</p>
        <ul className="mt-6 space-y-4">
          {(["planner", "progress", "practice"] as const).map((key) => (
            <li key={key} className="flex gap-3">
              <span className="mt-1 text-brand" aria-hidden="true">+</span>
              <span className="text-sm text-foreground/85">{t(`benefits.${key}`)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{t("benefits.accessWithoutAccount")}</p>
      </aside>
    </div>
  );
}
