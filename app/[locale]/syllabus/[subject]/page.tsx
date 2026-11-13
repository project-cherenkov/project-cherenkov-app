import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { SyllabusSourceFilter } from "@/components/site/syllabus-source-filter";
import { SyllabusToggleAll } from "@/components/site/syllabus-toggle-all";
import { Link } from "@/i18n/routing";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import { buildSubjectCoverage, type EditorialRef, type MaterialRef, type SectionEntry } from "@/lib/library";
import {
  describeTopicCoverage,
  getPrimarySource,
  getSyllabus,
  localize,
  sectionAnchor,
  sectionSourceIds,
  topicAnchor,
  topicLanguage,
  type SubjectSyllabus,
  type SyllabusSource,
  type SyllabusTopic,
} from "@/lib/syllabus";
import { SUBJECTS } from "@/lib/subjects";
import { pageMetadata } from "@/lib/seo-metadata";

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({ subject }));
}

const LIST_ID = "syllabus-sections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; subject: string }>;
}): Promise<Metadata> {
  const { locale, subject } = await params;
  const syllabus = getSyllabus(subject);
  if (!syllabus) return {};
  const t = await getTranslations({ locale, namespace: "syllabus" });
  const name = t(`subjects.${syllabus.subject}`);
  const sources = syllabus.sources.map((source) => source.short);
  return pageMetadata({
    locale,
    path: `/syllabus/${subject}`,
    title: t("subjectTitle", {
      // Sentence-initial in English ("Physics olympiad syllabus"), mid-sentence
      // in Indonesian ("Silabus olimpiade fisika"), so the casing follows the
      // language's own template.
      subject: locale === "en" ? name : name.toLocaleLowerCase(locale),
      sources: sources.join(", "),
    }),
    description: t("subjectDescription", {
      subjectLower: name.toLocaleLowerCase(locale),
      sources: new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(sources),
    }),
  });
}

export default async function SubjectSyllabusPage({
  params,
}: {
  params: Promise<{ locale: string; subject: string }>;
}) {
  const { locale, subject } = await params;
  setRequestLocale(locale);
  const syllabus = getSyllabus(subject);
  if (!syllabus) notFound();

  const t = await getTranslations("syllabus");
  const coverage = buildSubjectCoverage(syllabus, getAllMaterials(), getAllEditorials());
  const theory = coverage.sections.filter((entry) => entry.section.part === "theory");
  const practical = coverage.sections.filter((entry) => entry.section.part === "practical");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/syllabus" className="label-code inline-flex min-h-11 items-center hover:text-foreground">
        ← {t("title")}
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-foreground">{t(`subjects.${syllabus.subject}`)}</h1>
      <Provenance syllabus={syllabus} locale={locale} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="label-code">
          {[
            t("counts.topics", { count: coverage.topicCount }),
            // Zero counts read as emptiness; say "coming" once instead.
            ...(coverage.materialCount > 0
              ? [t("counts.materials", { count: coverage.materialCount })]
              : []),
            ...(coverage.editorialCount > 0
              ? [t("counts.editorials", { count: coverage.editorialCount })]
              : []),
            ...(coverage.materialCount === 0 && coverage.editorialCount === 0
              ? [t("counts.coming")]
              : []),
          ].join(" · ")}
        </p>
        <SyllabusToggleAll
          targetId={LIST_ID}
          expandLabel={t("expandAll")}
          collapseLabel={t("collapseAll")}
        />
      </div>

      {syllabus.sources.length > 1 && (
        <div className="mt-3">
          <SyllabusSourceFilter
            targetId={LIST_ID}
            options={syllabus.sources.map((source) => ({ id: source.id, label: source.short }))}
            label={t("filter.label")}
            allLabel={t("filter.all")}
            locale={locale}
          />
          <p className="mt-2 max-w-3xl text-xs text-muted-foreground">{t("coverage.legend")}</p>
        </div>
      )}

      <div id={LIST_ID} className="mt-6 space-y-3">
        <h2 className="heading-section">{t("theory")}</h2>
        {theory.map((entry) => (
          <SectionBlock
            key={entry.section.id}
            entry={entry}
            syllabus={syllabus}
          />
        ))}

        {practical.length > 0 && (
          <>
            <h2 className="heading-section pt-4">{t("practical")}</h2>
            {practical.map(({ section }) => {
              const ids = sectionSourceIds(syllabus, section);
              return (
                <div
                  key={section.id}
                  id={sectionAnchor(section.id)}
                  data-section
                  data-practical="true"
                  data-sources={ids.join(" ")}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <h3 className="font-semibold text-foreground">{localize(section.name, locale)}</h3>
                  <SourceBadges syllabus={syllabus} ids={ids} />
                  {section.note && (
                    <p
                      lang={getSourceLanguage(syllabus, ids)}
                      className="mt-1 text-sm text-foreground/75"
                    >
                      {section.note}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

async function SectionBlock({
  entry,
  syllabus,
}: {
  entry: SectionEntry;
  syllabus: SubjectSyllabus;
}) {
  const locale = await getLocale();
  const t = await getTranslations("syllabus");
  const { section, topics } = entry;
  const subject = syllabus.subject;

  return (
    <details
      id={sectionAnchor(section.id)}
      data-section
      open
      className="group rounded-lg border border-border bg-card"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="font-semibold text-foreground">{localize(section.name, locale)}</span>
        <span
          className="label-code ml-auto"
          data-count-for-section
          data-one={t("counts.topics", { count: 1 }).replace("1", "#")}
          data-other={t("counts.topics", { count: 2 }).replace("2", "#")}
        >
          {t("counts.topics", { count: topics.length })}
        </span>
      </summary>

      <ol className="divide-y divide-border border-t border-border">
        {topics.map(({ topic, material, editorials, subtopics }) => (
          <li
            key={topic.id}
            id={topicAnchor(topic.id)}
            data-topic
            data-sources={topic.in.join(" ")}
            className="px-4 py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h3 className="font-medium text-foreground">{localize(topic.name, locale)}</h3>
                <TopicBadges syllabus={syllabus} topic={topic} />
                {topic.detail && (
                  <p
                    lang={topicLanguage(syllabus, topic)}
                    className="mt-1 text-sm text-foreground/75"
                  >
                    {topic.detail}
                  </p>
                )}
                <EditorialLinks editorials={editorials} label={t("editorialsLabel")} />
              </div>

              {/* A topic that is broken into subtopics keeps its "coming
                  soon" for the subtopics themselves: the topic's own row
                  only shows a link when a material points at the topic. */}
              {(material || subtopics.length === 0) && (
                <MaterialLink
                  material={material}
                  subject={subject}
                  readLabel={t("readMaterial")}
                  soonLabel={t("comingSoon")}
                />
              )}
            </div>

            {subtopics.length > 0 && (
              <div className="mt-3 border-l-2 border-border pl-4">
                <p className="label-code">{t("subtopicsLabel")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("subtopicsNote")}</p>
                <ol className="mt-2 divide-y divide-border">
                  {subtopics.map(({ subtopic, material: subMaterial, editorials: subEditorials }) => (
                    <li
                      key={subtopic.id}
                      id={topicAnchor(subtopic.id)}
                      className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                    >
                      <div className="min-w-0">
                        <h4 className="font-medium text-foreground">
                          {localize(subtopic.name, locale)}
                        </h4>
                        {subtopic.detail && (
                          <p lang={topicLanguage(syllabus, topic)} className="mt-1 text-sm text-foreground/75">
                            {subtopic.detail}
                          </p>
                        )}
                        <EditorialLinks editorials={subEditorials} label={t("editorialsLabel")} />
                      </div>
                      <MaterialLink
                        material={subMaterial}
                        subject={subject}
                        readLabel={t("readMaterial")}
                        soonLabel={t("comingSoon")}
                      />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function EditorialLinks({
  editorials,
  label,
}: {
  editorials: EditorialRef[];
  label: string;
}) {
  if (editorials.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="label-code">{label}</span>
      {editorials.map((editorial) => (
        <Link
          key={editorial.slug}
          href={`/archive/${editorial.subject}/${editorial.slug}`}
          className="text-cherenkov-blue-800 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
        >
          {editorial.title}
        </Link>
      ))}
    </p>
  );
}

function MaterialLink({
  material,
  subject,
  readLabel,
  soonLabel,
}: {
  material: MaterialRef | undefined;
  subject: string;
  readLabel: string;
  soonLabel: string;
}) {
  return (
    <div className="shrink-0 sm:text-right">
      {material ? (
        <Link
          href={`/materials/${subject}/${material.slug}`}
          className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-wide text-cherenkov-blue-800 underline-offset-4 hover:underline dark:text-cherenkov-blue-pastel"
        >
          {readLabel} →
        </Link>
      ) : (
        <span className="label-code inline-flex min-h-11 items-center">{soonLabel}</span>
      )}
    </div>
  );
}

function getSourceLanguage(syllabus: SubjectSyllabus, ids: string[]): string {
  const first = syllabus.sources.find((source) => source.id === ids[0]);
  return (first ?? getPrimarySource(syllabus)).language;
}

const badgeClass =
  "label-code inline-flex items-center rounded bg-muted px-2 py-0.5 text-foreground/80";

// The badge for one topic, generated from which sources list it. No fixed
// categories: the wording follows from membership, so a new source needs no
// change here.
async function TopicBadges({
  syllabus,
  topic,
}: {
  syllabus: SubjectSyllabus;
  topic: SyllabusTopic;
}) {
  const t = await getTranslations("syllabus");
  const list = new Intl.ListFormat(await getLocale(), { style: "long", type: "conjunction" });
  const { listedIn, inPrimary, singleSource } = describeTopicCoverage(syllabus, topic);
  if (singleSource) return null;
  const primary = getPrimarySource(syllabus);
  const names = list.format(listedIn.map((source) => source.short));

  let text: string;
  if (!inPrimary) {
    text = t("coverage.notConfirmed", { sources: names, primary: primary.short });
  } else if (listedIn.length === 1) {
    text = t("coverage.only", { source: names });
  } else {
    text = t("coverage.listedIn", { sources: names });
  }

  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={badgeClass}>{text}</span>
      {listedIn.map((source) =>
        topic.refs?.[source.id] ? (
          <span key={source.id} className="label-code text-muted-foreground">
            {t("coverage.reference", { source: source.short, ref: topic.refs[source.id]! })}
          </span>
        ) : null,
      )}
    </p>
  );
}

// Same idea for a practical section, which carries its own sources.
async function SourceBadges({
  syllabus,
  ids,
}: {
  syllabus: SubjectSyllabus;
  ids: string[];
}) {
  const t = await getTranslations("syllabus");
  const list = new Intl.ListFormat(await getLocale(), { style: "long", type: "conjunction" });
  if (syllabus.sources.length < 2 || ids.length === 0) return null;
  const listedIn = syllabus.sources.filter((source) => ids.includes(source.id));
  const primary = getPrimarySource(syllabus);
  const names = list.format(listedIn.map((source) => source.short));
  const text = !ids.includes(primary.id)
    ? t("coverage.notConfirmed", { sources: names, primary: primary.short })
    : listedIn.length === 1
      ? t("coverage.only", { source: names })
      : t("coverage.listedIn", { sources: names });
  return (
    <p className="mt-1">
      <span className={badgeClass}>{text}</span>
    </p>
  );
}

// "Where this comes from": every source, who issues it, which edition, the
// official language, when the topic list was last compared and how far.
async function Provenance({ syllabus, locale }: { syllabus: SubjectSyllabus; locale: string }) {
  const t = await getTranslations("syllabus");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
  // One line of sources above the topic list; the full account sits in a
  // <details> so the topics, which most visitors came for, are on the first
  // screen and the provenance is one click away for those who want it.
  const summary = syllabus.sources
    .map(
      (source) =>
        `${source.short} (${t(source.kind === "national" ? "provenance.nationalKind" : "provenance.internationalKind").toLocaleLowerCase(locale)})`,
    )
    .join("; ");
  return (
    <section aria-labelledby="provenance-heading" className="mt-4 rounded-lg border border-border bg-card">
      <h2 id="provenance-heading" className="sr-only">
        {t("provenance.heading")}
      </h2>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="text-foreground/85">{t("provenance.summary", { sources: summary })}</span>
          <span className="inline-flex items-center gap-1 font-medium text-brand underline underline-offset-4">
            <ChevronRight
              aria-hidden
              className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
            {t("provenance.toggle")}
          </span>
        </summary>
        <div className="border-t border-border p-4">
          <p className="text-sm text-foreground/75">{t("provenance.intro")}</p>
          <ul className="mt-3 divide-y divide-border">
            {syllabus.sources.map((source) => (
              <ProvenanceSource
                key={source.id}
                source={source}
                locale={locale}
                comparedOn={source.accessed ? date.format(new Date(`${source.accessed}T00:00:00Z`)) : null}
              />
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">{t("provenance.ownWork")}</p>
        </div>
      </details>
    </section>
  );
}

async function ProvenanceSource({
  source,
  locale,
  comparedOn,
}: {
  source: SyllabusSource;
  locale: string;
  comparedOn: string | null;
}) {
  const t = await getTranslations("syllabus");
  const verificationKey = {
    compared: "compared",
    secondary: "secondary",
    "not-compared": "notCompared",
  }[source.verification];
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="font-medium text-foreground">
        <span className={`${badgeClass} mr-2`}>{source.short}</span>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
            aria-label={`${source.label} (${t("provenance.openSource")})`}
          >
            {source.label}
          </a>
        ) : (
          source.label
        )}
      </p>
      <p className="mt-1 text-sm text-foreground/75">
        {t(source.kind === "national" ? "provenance.nationalKind" : "provenance.internationalKind")} ·{" "}
        {t("provenance.issuedBy", { issuer: source.issuer })}
        {source.edition ? ` · ${t("provenance.edition", { edition: source.edition })}` : ""} ·{" "}
        {t("provenance.officialLanguage", { language: t(`languages.${source.language}`) })}
      </p>
      <p className="mt-1 text-sm text-foreground/75">
        {t(`verification.${verificationKey}`)} ·{" "}
        {comparedOn ? t("provenance.lastCompared", { date: comparedOn }) : t("provenance.notDated")}
      </p>
      {source.language !== locale && (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("provenance.unofficialGloss", { language: t(`languages.${locale === "en" ? "en" : "id"}`) })}
        </p>
      )}
      {source.note && (
        <p className="mt-1 text-sm text-muted-foreground">{source.note[locale === "id" ? "id" : "en"]}</p>
      )}
    </li>
  );
}
