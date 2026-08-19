"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";

interface ArchiveFiltersProps {
  subjects: string[];
  principles: string[];
  errorTypes: string[];
}

const FILTER_KEYS = ["subject", "principle", "errorType"] as const;

export function ArchiveFilters({
  subjects,
  principles,
  errorTypes,
}: ArchiveFiltersProps) {
  const t = useTranslations("archive.filters");
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
    <div className="flex flex-wrap items-center gap-3">
      <FilterSelect
        label={t("subject")}
        allLabel={t("allSubjects")}
        value={searchParams.get("subject") ?? ""}
        options={subjects}
        onChange={(v) => setFilter("subject", v)}
      />
      <FilterSelect
        label={t("principle")}
        allLabel={t("allPrinciples")}
        value={searchParams.get("principle") ?? ""}
        options={principles}
        onChange={(v) => setFilter("principle", v)}
      />
      <FilterSelect
        label={t("errorType")}
        allLabel={t("allErrorTypes")}
        value={searchParams.get("errorType") ?? ""}
        options={errorTypes}
        onChange={(v) => setFilter("errorType", v)}
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => router.push(pathname, { scroll: false })}
          className="label-code rounded-md border border-slate-300 px-3 py-2 hover:bg-white"
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
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-code">{label}</span>
      {/* Native <select> on purpose — best touch target + keyboard support
          on mobile for free, no custom listbox to maintain (spec §7/§8:
          mobile-first, touch-friendly, keyboard-operable). */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-[9rem] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
