// Serializable subject -> section -> topic options for the timer's pickers,
// localized. Pure: the caller passes the subject label lookup.
import { SUBJECTS, type Subject } from "./subjects";
import { getSyllabus, localize } from "./syllabus";

export interface PickerSubjectOption {
  subject: Subject;
  label: string;
  sections: { id: string; name: string; topics: { id: string; name: string }[] }[];
}

export function buildPickerSubjects(
  locale: string,
  labelFor: (subject: Subject) => string,
): PickerSubjectOption[] {
  return SUBJECTS.flatMap((subject) => {
    const syllabus = getSyllabus(subject);
    if (!syllabus) return [];
    return [
      {
        subject,
        label: labelFor(subject),
        sections: syllabus.sections
          .filter((section) => section.topics.length > 0)
          .map((section) => ({
            id: section.id,
            name: localize(section.name, locale),
            topics: section.topics.map((topic) => ({
              id: topic.id,
              name: localize(topic.name, locale),
            })),
          })),
      },
    ];
  });
}
