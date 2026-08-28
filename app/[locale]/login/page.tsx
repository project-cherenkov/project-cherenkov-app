import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

// AUTH-002. Google button visibility is decided server-side (GOOGLE_CLIENT_ID
// isn't a NEXT_PUBLIC_* var) and passed down as a plain boolean — same
// graceful-degradation pattern already used for Keystatic's GitHub OAuth.
export default function LoginPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}

