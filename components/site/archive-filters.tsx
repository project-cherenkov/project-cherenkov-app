"use client";

import { Select } from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { humanizeSlug } from "@/lib/utils";

interface ArchiveFiltersProps {
  subjects: string[];
  principles: string[];
  errorTypes: string[];
}

const SUBJECT_KEYS = ["informatics", "physics", "astronomy"];
function isKnownSubject(value: string): value is "informatics" | "physics" | "astronomy" {
  return SUBJECT_KEYS.includes(value);
}

const FILTER_KEYS = ["subject", "principle", "errorType", "tag"] as const;

export function ArchiveFilters({
  subjects,
  principles,
  errorTypes,
}: ArchiveFiltersProps) {
  const t = useTranslations("archive.filters");
  const tSubjects = useTranslations("syllabus.subjects");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const hasActiveFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label={t("subject")}
        allLabel={t("allSubjects")}
        value={searchParams.get("subject") ?? ""}
        options={subjects}
        labelFor={(value) => (isKnownSubject(value) ? tSubjects(value) : value)}
        onChange={(v) => setFilter("subject", v)}
      />
      <FilterSelect
        label={t("principle")}
        allLabel={t("allPrinciples")}
        value={searchParams.get("principle") ?? ""}
        options={principles}
        labelFor={humanizeSlug}
        onChange={(v) => setFilter("principle", v)}
      />
      <FilterSelect
        label={t("errorType")}
        allLabel={t("allErrorTypes")}
        value={searchParams.get("errorType") ?? ""}
        options={errorTypes}
        labelFor={humanizeSlug}
        onChange={(v) => setFilter("errorType", v)}
      />

      {searchParams.get("tag") && (
        <span className="label-mono inline-flex min-h-11 items-center rounded-full bg-cherenkov-pink/40 px-3 text-foreground dark:bg-cherenkov-pink/25">
          {t("tag")}: {searchParams.get("tag")}
        </span>
      )}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => router.push(pathname, { scroll: false })}
          className="label-code inline-flex min-h-11 items-center rounded-md border border-border-strong px-3 hover:bg-muted"
        >
          {t("clear")}
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  allLabel,
  value,
  options,
  labelFor,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: string[];
  labelFor?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
      <span className="label-code">{label}</span>
      {/* Native <select> on purpose — best touch target + keyboard support
          on mobile for free, no custom listbox to maintain (spec §7/§8:
          mobile-first, touch-friendly, keyboard-operable). */}
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sm:w-auto sm:min-w-[9rem] sm:max-w-full"
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelFor ? labelFor(opt) : opt}
          </option>
        ))}
      </Select>
    </label>
  );
}
