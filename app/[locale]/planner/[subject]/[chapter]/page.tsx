import { getTranslations, getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getTopicBySubjectAndChapter, getTopicStatus } from "@/lib/planner";
import { getQuizQuestionsForTopic } from "@/lib/quiz";
import { ChapterView } from "@/components/planner/chapter-view";
import { QuizDialog } from "@/components/quiz/quiz-dialog";

// PLANNER-003. Route shape reserved since Phase 1 (see the prior placeholder's
// own comment, now replaced) — resolves against lib/planner.ts's
// getTopicBySubjectAndChapter (chapter matches topics.chapter directly; see
// that function's header comment for why that's a safe, already-URL-safe
// match).
export default async function PlannerChapterPage({
  params,
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { subject, chapter } = await params;

  const [t, locale, user] = await Promise.all([
    getTranslations("phase2.planner"),
    getLocale(),
    getCurrentUser(),
  ]);

  // Defensive fallback only — middleware.ts already blocks this route for
  // unauthenticated requests (spec §9 defense-in-depth).
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const topic = await getTopicBySubjectAndChapter(subject, chapter);
  if (!topic) {
    notFound();
  }

  const [status, questions] = await Promise.all([
    getTopicStatus(user.id, topic.id),
    getQuizQuestionsForTopic(topic.id),
  ]);

  return (
    <ChapterView
      labels={{
        backToPlanner: t("backToPlanner"),
        openEditorial: t("openEditorial"),
        noEditorial: t("noEditorial"),
        statusDone: t("statusDone"),
        statusInProgress: t("statusInProgress"),
        statusNotStarted: t("statusNotStarted"),
      }}
      title={topic.title}
      status={status}
      editorialHref={
        topic.editorialSlug
          ? `/${locale}/archive/${topic.subject}/${topic.editorialSlug}`
          : null
      }
      plannerHref={`/${locale}/planner`}
      quizDialog={<QuizDialog topicId={topic.id} questions={questions} />}
    />
  );
}
