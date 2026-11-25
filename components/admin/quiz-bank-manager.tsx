"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { summarizeQuestionForAdmin } from "@/lib/quiz-admin";
import { QUESTION_TYPES, type QuestionType } from "@/lib/quiz-types";

type Subject = "informatics" | "physics" | "astronomy";
type Difficulty = "basic" | "intermediate" | "advanced";
type Status = "draft" | "reviewed";
interface Topic { id: string; subject: Subject; title: string; chapter: string; order: number }
interface Question {
  id: string; key: string | null; source: "git" | "database"; topicId: string; subject: Subject; topicTitle: string;
  chapter: string; topicOrder: number; prompt: string; questionType: QuestionType; content: unknown; answerKey: unknown;
  explanation: string | null; difficulty: Difficulty; status: Status; archived: boolean;
}
const subjects: Subject[] = ["informatics", "physics", "astronomy"];
const difficulties: Difficulty[] = ["basic", "intermediate", "advanced"];
const collectionLabel: Record<Subject, string> = { informatics: "Quiz: Informatics", physics: "Quiz: Physics", astronomy: "Quiz: Astronomy" };

async function responseError(response: Response) {
  try { return (await response.json()).error ?? `Request failed (${response.status}).`; }
  catch { return `Request failed (${response.status}).`; }
}

// Questions are written in Keystatic (collections "Quiz: <subject>") and synced
// into the database with `pnpm db:seed:quiz`; this page is the read-only view
// of what the database currently serves, plus the emergency archive / restore
// switch. See lib/quiz-bank/sync.ts for the rules.
export function QuizBankManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/keystatic/quiz-questions", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json();
      setQuestions(result.questions);
      setTopics(result.topics);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load questions.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => questions.filter((question) =>
    (subjectFilter === "all" || question.subject === subjectFilter) &&
    (topicFilter === "all" || question.topicId === topicFilter) &&
    (difficultyFilter === "all" || question.difficulty === difficultyFilter) &&
    (typeFilter === "all" || question.questionType === typeFilter) &&
    (statusFilter === "all" || (statusFilter === "active" ? !question.archived : statusFilter === "archived" ? question.archived : !question.archived && question.status === statusFilter))
  ), [questions, subjectFilter, topicFilter, statusFilter, difficultyFilter, typeFilter]);
  const coverage = useMemo(() => {
    const active = questions.filter((question) => !question.archived && question.status === "reviewed");
    return topics.map((topic) => ({
      ...topic,
      count: active.filter((question) => question.topicId === topic.id).length,
      missing: difficulties.filter((difficulty) => !active.some((question) => question.topicId === topic.id && question.difficulty === difficulty)),
    }));
  }, [questions, topics]);
  const databaseOnly = questions.filter((question) => question.source === "database").length;

  async function setArchived(question: Question, archived: boolean) {
    setBusyId(question.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/keystatic/quiz-questions/${question.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ archived }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage(archived ? "Question archived. Students no longer receive it." : "Question restored.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update question."); }
    finally { setBusyId(null); }
  }

  return <main className="mx-auto max-w-7xl space-y-10 px-4 py-10">
    <header>
      <h1 className="text-3xl font-bold">Quiz question bank</h1>
      <p className="mt-2 text-sm text-muted-foreground">Students only receive active questions marked reviewed.</p>
      <div className="mt-4 rounded-xl border border-border p-4 text-sm">
        <p className="font-medium">Questions are written in Keystatic, not here.</p>
        <p className="mt-1 text-muted-foreground">
          Open <Link className="underline" href="/keystatic">Keystatic</Link> and use the <span className="font-medium">Quiz: Informatics / Physics / Astronomy</span> collections.
          Saved questions become files in git; after the change is merged, run <code>pnpm db:seed:quiz</code> to sync them into the database that students read.
          This page shows what the database serves right now, and lets you archive a bad question immediately (no merge or sync needed) or restore it.
          A question you archive here stays archived through later syncs until you restore it here.
        </p>
        {databaseOnly > 0 && <p className="mt-2 text-muted-foreground" role="status">
          {databaseOnly} question(s) below are marked <span className="font-medium">Database only</span>: they were made in the old editor and are not in git yet. Run <code>pnpm quiz:export-db</code> to move them.
        </p>}
      </div>
    </header>
    <section className="space-y-4" aria-labelledby="coverage-heading">
      <div><h2 id="coverage-heading" className="text-xl font-semibold">Reviewed question coverage</h2><p className="text-sm text-muted-foreground">Active reviewed counts by syllabus topic and missing difficulty tiers.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{coverage.map((topic) => <article key={topic.id} className="rounded-lg border border-border p-3 text-sm">
        <div className="font-medium">{topic.subject} / {topic.title}</div><div className="mt-1 text-muted-foreground">{topic.count} reviewed | Missing: {topic.missing.length ? topic.missing.join(", ") : "none"}</div>
      </article>)}</div>
    </section>
    <section className="space-y-4" aria-labelledby="questions-heading">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="questions-heading" className="text-xl font-semibold">Questions</h2><p className="text-sm text-muted-foreground">{filtered.length} shown</p></div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <select aria-label="Filter by subject" className="min-h-10 min-w-0 max-w-full rounded-md border border-border-strong bg-background px-2" value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setTopicFilter("all"); }}><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>
          <select aria-label="Filter by topic" className="min-h-10 min-w-0 max-w-full rounded-md border border-border-strong bg-background px-2" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="all">All topics</option>{topics.filter((topic) => subjectFilter === "all" || topic.subject === subjectFilter).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
          <select aria-label="Filter by difficulty" className="min-h-10 min-w-0 max-w-full rounded-md border border-border-strong bg-background px-2" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">All difficulties</option>{difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}</select>
          <select aria-label="Filter by question type" className="min-h-10 min-w-0 max-w-full rounded-md border border-border-strong bg-background px-2" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All types</option>{QUESTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select aria-label="Filter by status" className="min-h-10 min-w-0 max-w-full rounded-md border border-border-strong bg-background px-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">All active</option><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="archived">Archived</option><option value="all">All</option></select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {loading ? <p>Loading questions...</p> : filtered.length === 0 ? <p className="text-sm text-muted-foreground">No questions match these filters.</p> : <div className="space-y-3">{filtered.map((question) => <article key={question.id} className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{question.subject} / {question.topicTitle} / {question.difficulty} / {question.questionType} / {question.archived ? "archived" : question.status}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {question.source === "git"
                ? <>In git as <code>{question.key}</code>. Edit it in Keystatic, collection {collectionLabel[question.subject]}.</>
                : <><span className="font-medium">Database only</span>, not in git yet. Run <code>pnpm quiz:export-db</code>.</>}
            </p>
            <p className="mt-2 font-medium">{question.prompt}</p>
            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground" aria-label="Answer key (editors only)">
              {summarizeQuestionForAdmin(question.content, question.answerKey).map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          </div>
          <Button variant="outline" size="sm" disabled={busyId === question.id} onClick={() => setArchived(question, !question.archived)}>
            {question.archived ? "Restore" : "Archive now"}
          </Button>
        </div>
      </article>)}</div>}
    </section>
  </main>;
}
