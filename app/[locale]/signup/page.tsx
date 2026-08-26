import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);
  return <SignupForm googleEnabled={googleEnabled} />;
}
