import { getAllEditorials, resolveEditorialText, type Subject } from "@/lib/content";
import { isHomeVizKey } from "@/lib/home-viz-picks";

// What the home hero can show: every published editorial that has a
// visualization. Built on the server and passed to the client picker as plain
// data, so the picker lists what the archive really contains and never keeps
// its own copy of a visualization's configuration (the old hero did, and the
// copies drifted from the editorials).
export interface HomeVizCandidate {
  /** "<subject>/<slug>", the identity a pick is saved under. */
  key: string;
  subject: Subject;
  slug: string;
  /** In the page's language when the editorial has a translation, else the original's. */
  title: string;
  titleLang: string;
  /**
   * The authored one-sentence result of the visualization. It exists only in
   * the editorial's own language (translations carry title, hook and body
   * only), so it comes with the language to mark it with.
   */
  description?: string;
  descriptionLang: string;
  vizConfig: ReturnType<typeof getAllEditorials>[number]["vizConfig"];
}

export function getHomeVizCandidates(locale: string): HomeVizCandidate[] {
  return getAllEditorials()
    .filter((editorial) => editorial.vizConfig.discriminant !== "none")
    .map((editorial) => {
      const { text } = resolveEditorialText(editorial, locale);
      return {
        key: `${editorial.subject}/${editorial.slug}`,
        subject: editorial.subject,
        slug: editorial.slug,
        title: text.title,
        titleLang: text.locale,
        description: editorial.vizDescription,
        descriptionLang: editorial.language,
        vizConfig: editorial.vizConfig,
      };
    })
    .filter((candidate) => isHomeVizKey(candidate.key));
}
