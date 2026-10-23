"use client";

import { useTranslations } from "next-intl";

export interface PickerSubject {
  subject: string;
  label: string;
  sections: { id: string; name: string; topics: { id: string; name: string }[] }[];
}

export interface PickerPlanItem {
  id: string;
  label: string;
  subject: string;
  syllabusTopicId: string;
  minutes: number | null;
}

export interface PickerValue {
  subject: string;
  syllabusTopicId: string;
  planItemId: string;
}

const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

// Subject -> topic, plus an optional plan item. Choosing a plan item fills in
// (and locks) its subject and topic, so a session can never be attached to a
// plan item for one topic while claiming another.
export function TopicPicker({
  subjects,
  planItems,
  value,
  onChange,
  disabled,
}: {
  subjects: PickerSubject[];
  planItems: PickerPlanItem[];
  value: PickerValue;
  onChange: (next: PickerValue) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("timer");
  const subject = subjects.find((entry) => entry.subject === value.subject);
  const locked = value.planItemId !== "";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {planItems.length > 0 ? (
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-foreground">{t("planItem")}</span>
          <select
            className={selectClass}
            disabled={disabled}
            value={value.planItemId}
            onChange={(event) => {
              const item = planItems.find((entry) => entry.id === event.target.value);
              onChange(
                item
                  ? { subject: item.subject, syllabusTopicId: item.syllabusTopicId, planItemId: item.id }
                  : { ...value, planItemId: "" },
              );
            }}
          >
            <option value="">{t("noPlanItem")}</option>
            {planItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.minutes ? ` · ${item.minutes} min` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="space-y-1 text-sm">
        <span className="font-medium text-foreground">{t("subject")}</span>
        <select
          className={selectClass}
          disabled={disabled || locked}
          value={value.subject}
          onChange={(event) =>
            onChange({ subject: event.target.value, syllabusTopicId: "", planItemId: "" })
          }
        >
          <option value="">{t("noTopic")}</option>
          {subjects.map((entry) => (
            <option key={entry.subject} value={entry.subject}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium text-foreground">{t("topic")}</span>
        <select
          className={selectClass}
          disabled={disabled || locked || !subject}
          value={value.syllabusTopicId}
          onChange={(event) => onChange({ ...value, syllabusTopicId: event.target.value })}
        >
          <option value="">{t("anyTopic")}</option>
          {subject?.sections.map((section) => (
            <optgroup key={section.id} label={section.name}>
              {section.topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
}
