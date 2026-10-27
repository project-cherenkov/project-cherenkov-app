"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

type Subject = "informatics" | "physics" | "astronomy";
type Difficulty = "basic" | "intermediate" | "advanced";
type Status = "draft" | "reviewed";
interface Topic { id: string; subject: Subject; title: string; chapter: string; order: number }
interface Question {
  id: string; key: string | null; topicId: string; subject: Subject; topicTitle: string; chapter: string;
  topicOrder: number; prompt: string; choices: string[]; correctChoiceIndex: number; explanation: string | null;
  difficulty: Difficulty; status: Status; archived: boolean;
}
interface FormState {
  id?: string; subject: Subject; topicId: string; prompt: string; choices: string[];
  correctChoiceIndex: number; explanation: string; difficulty: Difficulty; status: Status; archived: boolean;
}
const subjects: Subject[] = ["informatics", "physics", "astronomy"];
const difficulties: Difficulty[] = ["basic", "intermediate", "advanced"];
const emptyForm = (): FormState => ({ subject: "informatics", topicId: "", prompt: "", choices: ["", ""], correctChoiceIndex: 0, explanation: "", difficulty: "basic", status: "draft", archived: false });

async function responseError(response: Response) {
  try { return (await response.json()).error ?? `Request failed (${response.status}).`; }
  catch { return `Request failed (${response.status}).`; }
}

export function QuizBankManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    (statusFilter === "all" || (statusFilter === "active" ? !question.archived : statusFilter === "archived" ? question.archived : !question.archived && question.status === statusFilter))
  ), [questions, subjectFilter, topicFilter, statusFilter, difficultyFilter]);
  const coverage = useMemo(() => {
    const active = questions.filter((question) => !question.archived && question.status === "reviewed");
    return topics.map((topic) => ({
      ...topic,
      count: active.filter((question) => question.topicId === topic.id).length,
      missing: difficulties.filter((difficulty) => !active.some((question) => question.topicId === topic.id && question.difficulty === difficulty)),
    }));
  }, [questions, topics]);

  function edit(question: Question) {
    setForm({
      id: question.id, subject: question.subject, topicId: question.topicId, prompt: question.prompt,
      choices: [...question.choices], correctChoiceIndex: question.correctChoiceIndex,
      explanation: question.explanation ?? "", difficulty: question.difficulty,
      status: question.status, archived: question.archived,
    });
    setMessage(""); setError(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const body = {
      subject: form.subject, topicId: form.topicId, prompt: form.prompt, choices: form.choices,
      correctChoiceIndex: form.correctChoiceIndex, explanation: form.explanation, difficulty: form.difficulty,
      ...(form.id ? { status: form.status, archived: form.archived } : {}),
    };
    try {
      const response = await fetch(form.id ? `/api/keystatic/quiz-questions/${form.id}` : "/api/keystatic/quiz-questions", {
        method: form.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage(form.id ? "Question updated." : "Question saved as a draft.");
      setForm(emptyForm()); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save question."); }
    finally { setSaving(false); }
  }
  function updateChoice(index: number, value: string) {
    setForm((current) => ({ ...current, choices: current.choices.map((choice, i) => i === index ? value : choice) }));
  }

  return <main className="mx-auto max-w-7xl space-y-10 px-4 py-10">
    <header>
      <h1 className="text-3xl font-bold">Quiz question bank</h1>
      <p className="mt-2 text-sm text-muted-foreground">Questions are stored in the database. Students only receive active questions marked reviewed.</p>
    </header>
    <section className="rounded-xl border border-border p-5" aria-labelledby="editor-heading">
      <h2 id="editor-heading" className="text-xl font-semibold">{form.id ? "Edit question" : "Create question"}</h2>
      <form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">Subject
          <select className="min-h-11 rounded-md border border-border-strong bg-background px-3" value={form.subject} onChange={(event) => {
            const subject = event.target.value as Subject;
            setForm((current) => ({ ...current, subject, topicId: "" }));
          }}>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>
        </label>
        <label className="grid gap-1 text-sm">Topic
          <select required className="min-h-11 rounded-md border border-border-strong bg-background px-3" value={form.topicId} onChange={(event) => setForm((current) => ({ ...current, topicId: event.target.value }))}>
            <option value="">Select a topic</option>{topics.filter((topic) => topic.subject === form.subject).map((topic) => <option key={topic.id} value={topic.id}>{topic.chapter} ? {topic.title}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Difficulty
          <select className="min-h-11 rounded-md border border-border-strong bg-background px-3" value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as Difficulty }))}>{difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}</select>
        </label>
        {form.id && <>
          <label className="grid gap-1 text-sm">Review status
            <select className="min-h-11 rounded-md border border-border-strong bg-background px-3" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Status }))}><option value="draft">Draft</option><option value="reviewed">Reviewed ? available to students</option></select>
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={form.archived} onChange={(event) => setForm((current) => ({ ...current, archived: event.target.checked }))} /> Archived (hidden from student quizzes; can be restored)</label>
        </>}
        <label className="grid gap-1 text-sm md:col-span-2">Question prompt
          <textarea required rows={4} maxLength={20000} className="rounded-md border border-border-strong bg-background px-3 py-2" value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} />
        </label>
        <fieldset className="grid gap-3 md:col-span-2">
          <legend className="text-sm font-medium">Answer choices ? select the correct answer</legend>
          {form.choices.map((choice, index) => <div key={index} className="flex items-center gap-3">
            <input aria-label={`Choice ${index + 1} is correct`} type="radio" name="correctChoice" checked={form.correctChoiceIndex === index} onChange={() => setForm((current) => ({ ...current, correctChoiceIndex: index }))} />
            <input required aria-label={`Answer choice ${index + 1}`} className="min-h-11 flex-1 rounded-md border border-border-strong bg-background px-3" value={choice} onChange={(event) => updateChoice(index, event.target.value)} />
            {form.choices.length > 2 && <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, choices: current.choices.filter((_, i) => i !== index), correctChoiceIndex: current.correctChoiceIndex === index ? 0 : current.correctChoiceIndex > index ? current.correctChoiceIndex - 1 : current.correctChoiceIndex }))}>Remove</Button>}
          </div>)}
          <Button type="button" variant="outline" className="w-fit" onClick={() => setForm((current) => ({ ...current, choices: [...current.choices, ""] }))}>Add choice</Button>
        </fieldset>
        <label className="grid gap-1 text-sm md:col-span-2">Explanation
          <textarea required rows={3} className="rounded-md border border-border-strong bg-background px-3 py-2" value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} />
        </label>
        {error && <p role="alert" className="text-sm text-red-700 md:col-span-2">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-700 md:col-span-2">{message}</p>}
        <div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving?" : form.id ? "Save changes" : "Save draft"}</Button>
          {form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyForm())}>Cancel edit</Button>}</div>
      </form>
    </section>
    <section className="space-y-4" aria-labelledby="coverage-heading">
      <div><h2 id="coverage-heading" className="text-xl font-semibold">Reviewed question coverage</h2><p className="text-sm text-muted-foreground">Active reviewed counts by syllabus topic and missing difficulty tiers.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{coverage.map((topic) => <article key={topic.id} className="rounded-lg border border-border p-3 text-sm">
        <div className="font-medium">{topic.subject} ? {topic.title}</div><div className="mt-1 text-muted-foreground">{topic.count} reviewed ? missing: {topic.missing.length ? topic.missing.join(", ") : "none"}</div>
      </article>)}</div>
    </section>
    <section className="space-y-4" aria-labelledby="questions-heading">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="questions-heading" className="text-xl font-semibold">Questions</h2><p className="text-sm text-muted-foreground">{filtered.length} shown</p></div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter by subject" className="min-h-10 rounded-md border border-border-strong bg-background px-2" value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setTopicFilter("all"); }}><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>
          <select aria-label="Filter by topic" className="min-h-10 rounded-md border border-border-strong bg-background px-2" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option value="all">All topics</option>{topics.filter((topic) => subjectFilter === "all" || topic.subject === subjectFilter).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select>
          <select aria-label="Filter by difficulty" className="min-h-10 rounded-md border border-border-strong bg-background px-2" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="all">All difficulties</option>{difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}</select>
          <select aria-label="Filter by status" className="min-h-10 rounded-md border border-border-strong bg-background px-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">All active</option><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="archived">Archived</option><option value="all">All</option></select>
        </div>
      </div>
      {loading ? <p>Loading questions?</p> : filtered.length === 0 ? <p className="text-sm text-muted-foreground">No questions match these filters.</p> : <div className="space-y-3">{filtered.map((question) => <article key={question.id} className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{question.subject} ? {question.topicTitle} ? {question.difficulty} ? {question.archived ? "archived" : question.status}</p><p className="mt-2 font-medium">{question.prompt}</p></div><Button variant="outline" size="sm" onClick={() => edit(question)}>Edit</Button></div>
      </article>)}</div>}
    </section>
  </main>;
}
