"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input, type InputProps } from "@/components/ui/input";

// A password field with a show/hide toggle. The toggle is a real <button>
// (44px target, aria-pressed) and sits inside the field's right edge. The
// input stays type="password" by default so password managers and the
// browser's own handling are unchanged.
export function PasswordInput({
  className,
  ...props
}: Omit<InputProps, "type">) {
  const t = useTranslations("phase2.login");
  const [visible, setVisible] = useState(false);
  const toggleId = useId();

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={["pr-12", className].filter(Boolean).join(" ")}
      />
      <button
        id={toggleId}
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
