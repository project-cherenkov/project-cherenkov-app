import { QuizBankManager } from "@/components/admin/quiz-bank-manager";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";

export default async function QuizBankPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return <main className="mx-auto max-w-3xl px-4 py-16">
    <h1 className="text-2xl font-bold">Quiz question bank</h1>
    <p className="mt-3 text-muted-foreground">Sign in with an authorized editor account to manage quiz questions.</p>
  </main>;
  return <QuizBankManager />;
}
