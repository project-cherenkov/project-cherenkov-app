# Internationalization (UI strings)

Written 2026-11-16. How the interface strings are stored, loaded and checked. This is the source of truth for the message files; it is not about translating editorials, materials or `content/docs` pages (see the root `README.md`, section VI-b, for those) or syllabus names (stored in the syllabus data itself).

Code wins. If this file disagrees with `messages/`, `i18n/` or the two message tests, the code is right and this file should be corrected.

## Layout

```
messages/
  index.ts              loadMessages(locale): one dynamic import per locale
  define-catalogue.ts   merges a locale's files; throws on a repeated namespace
  en/
    index.ts            lists every file below and merges them
    common.json ... viz.json
  id/                   same file names, same keys
```

Locales are `id` (default) and `en`, declared in `i18n/routing.ts`. `i18n/request.ts` calls `loadMessages`, so a request only loads its own locale.

Each JSON file holds whole top-level namespaces. Components never need to know which file a string lives in: `useTranslations("viz")` and `getTranslations("syllabus.subjects")` address the merged object.

| File | Top-level namespaces |
| --- | --- |
| `common.json` | `site`, `nav`, `footer`, `error`, `notFound`, `search` |
| `home.json` | `home` |
| `about.json` | `about` |
| `account.json` | `account` (includes the email-verified and account-deleted pages) |
| `auth.json` | `auth` (login, signup, forgot, reset, `errors`, `codes`) |
| `planner.json` | `planner` (`chapter`, `settings`, `ratings`, `errors`, `onboarding`, `plan`, `reason`) |
| `quiz.json` | `quiz` |
| `study-tools.json` | `studyTools`, `progress`, `review`, `timer` |
| `archive.json` | `archive`, `editorial`, `materials`, `understood` |
| `syllabus.json` | `syllabus` |
| `docs.json` | `docs` |
| `legal.json` | `legal` |
| `updates.json` | `updates` |
| `companion.json` | `companion` (the Neutrino companion) |
| `viz.json` | `viz` |

## Everyday tasks

- Add or change a string: edit the same key in `messages/en/<file>.json` and `messages/id/<file>.json`. Placeholders (`{name}`) must match in both.
- Add a namespace to an existing area: add it to that file in both locales.
- Add a file: create it in both folders, then import it and pass it to `defineCatalogue` in both `messages/en/index.ts` and `messages/id/index.ts`. A namespace may live in only one file.
- Add a locale: add it to `locales` in `i18n/routing.ts`, add `messages/<locale>/` with the same files and an `index.ts`, and add one line to `loaders` in `messages/index.ts` (the `Record<Locale, ...>` type makes TypeScript fail until you do). Syllabus names live in the syllabus data (`LocalizedText` in `lib/syllabus/types.ts`).
- In tests, import a catalogue with `import en from "@/messages/en"` (no `.json`).

Name a file after the feature, not the time it was written. The early `phase2` and `phase3` namespaces were renamed for that reason.

## What is checked

- `messages-parity.test.ts`: `en` and `id` have the same files, the same keys, no empty strings and matching ICU placeholders; no JSON file repeats an object key; no namespace appears in two files; every file reaches the merged catalogue; `loadMessages` serves both locales.
- `messages-namespaces.test.ts`: every literal namespace passed to `useTranslations` or `getTranslations` exists in both locales.
- TypeScript: `messages/index.ts` types the `id` catalogue against the `en` shape, so a missing top-level namespace in `id` fails `pnpm typecheck`.

## Pitfalls

- Repeated JSON keys are silent. `JSON.parse` keeps the last duplicate, so the first block disappears and nothing fails. This hid `syllabus.coverage.label` until 2026-11-16. The duplicate-key test now guards against it.
- A misspelled namespace or key does not throw. next-intl logs an error and renders the key path. The namespace test covers literal namespaces only.
- Keys built at runtime, such as ``t(`coverage.status.${status}` as never)``, are not checked by any test. Keep the full set of possible values in both locales when you add one.
- Splitting the files does not shrink what the browser gets. `app/[locale]/layout.tsx` passes the whole catalogue (`getMessages()`) to `NextIntlClientProvider`, so every page ships every string, about 70 KB of JSON per locale. That is fine today; if it grows, pass only the namespaces each route needs.
