# OSN Astronomy stage calibration

> Status: current project decision, 25 November 2026. This is a preparation-band policy for Project Cherenkov, not an official OSN/Puspresnas difficulty taxonomy.

## Approved stage bands

| Stage | Inclusive preparation/evidence band | `masteryTarget` |
|---|---|---:|
| OSN-K | Basic–Intermediate | 0.70 |
| OSN-P | Intermediate–Advanced | 0.80 |
| OSN Semifinal | Basic–Advanced | 0.85 |
| OSN Final | Advanced only | 0.85 |

OSN-K remains Basic–Intermediate. OSN-P remains Intermediate–Advanced. The Semifinal is widened from Advanced-only to Basic–Advanced because its 2025 paper contains both relatively direct observational/geometry problems and substantially more demanding orbital, spectral, cosmological and gravitational-wave problems. The Final remains Advanced-only as its preparation/mastery-evidence band because the 2025 national paper comprises integrated, multi-part essay problems. The Final mastery target remains 0.85; it is not raised to 0.95.

These bands do not imply that every item in a stage's paper has one uniform difficulty. The difficulty label belongs to an individual question and is determined by the minimum defensible reasoning required, not by the examination stage, number of calculations or question format.

## Evidence reviewed

The reviewed source is the 77-page combined 2025 OSN Astronomy examination compilation supplied for Project Cherenkov. PDF page references below refer to the compilation, not the printed page numbers within the reproduced exam booklet.

| Stage | PDF pages | Paper format stated in instructions | Examples of reasoning demand observed |
|---|---:|---|---|
| National Final (stage identification is by elimination; opening heading is generic) | 2–32 | 8 essay questions | Multi-part spherical astronomy; binary-star properties inferred from angular resolution, spectra and light curves; asteroid collision geometry and Hohmann transfer; nuclear energy and stellar evolution; calendar conversion; cluster statistics, virial reasoning and cosmology; transits; supernova spectra, lensing and extinction. |
| Semifinal | 33–44 | 20 questions: ordinary MCQ, complex MCQ and short answer | Horizon-distance geometry and star-chart interpretation coexist with orbital transfer, cosmology, galaxy spectra, comet orbits and gravitational-wave reasoning. |
| OSN-P | 45–66 | 30 questions: ordinary MCQ, complex MCQ and short answer | Galaxy spectral classification/redshift; Friedmann-parameter graph interpretation; microlensing curves/caustics; binary-star inference; multi-step applications of supplied data. |
| OSN-K | 67–77 | 30 questions: ordinary and complex MCQ | Inverse relation recognition from a wavelength-temperature table; sunrise/equinox and daylight geometry; meridian/coordinate relationships; Kepler-law inference from period and semimajor-axis tables; stellar angular-size/distance and binary-orbit calculations. |

The OSN-K evidence is especially important when considering Basic-only. The paper does contain straightforward concept-recognition items, but it also requires interpretation of supplied equations and data, choosing a physical relationship and combining more than one quantity. It is not a recall-only examination. Therefore Intermediate preparation belongs in the OSN-K pool.

The Semifinal evidence directly contradicts the assumption that every Semifinal preparation item must be Advanced. Its first page contains a horizon-distance calculation, while later material includes substantially more complex physical reasoning. A mixed band is the appropriate preparation response.

The OSN-P mapping is consistent with its use of graphs, spectra, light curves and multi-step physical interpretation. The Final's eight essays are integrated tasks. A question extracted as a standalone quiz item must nevertheless be classified by its own minimum reasoning demand; an easy sub-calculation does not become Advanced simply because it appeared inside an advanced essay.

## Difficulty rubric for individual bank questions

- **Basic:** one central concept or familiar relationship; direct recognition, interpretation or a straightforward calculation. Little or no model-selection burden.
- **Intermediate:** two or three linked reasoning steps, or a meaningful choice of equation/model; interprets a graph, table, spectrum or observational condition and then applies a physical relationship; combines familiar concepts.
- **Advanced:** non-routine modelling, derivation or synthesis; coordinates several observables or constraints; evaluates consequential assumptions/approximations; or performs nontrivial numerical/statistical reasoning. Long arithmetic alone does not qualify.

Question format is independent of difficulty. A Basic multiple-select is possible; an Advanced single-choice is possible. The pilot bank deliberately uses more complex formats more often at higher difficulty, but writers must classify the reasoning first.

## Mastery-target semantics

The current targets (0.70, 0.80, 0.85, 0.85) are retained. They are not exam percentages. `lib/mastery.ts` computes a Beta posterior from a weak self-rating prior and recorded correct/incorrect answer evidence, with a 30-day answer-weight half-life. A topic is `known` only when the posterior's 10th-percentile lower bound reaches the stage target. The current prior mapping, prior strength, half-life, quantile and calibration parameters are marked as placeholders in code and have not been calibrated against student outcomes. Do not claim that a 0.85 target means an 85% quiz score.

The planner's `MASTERY_THRESHOLD = 0.8` in `lib/planner.ts` is a separate latest-attempt topic-completion threshold. It is not changed by this stage-band decision.

Repeated responses to the same question create response records and are not deduplicated by the current mastery estimator. A high target therefore cannot be treated as proof of independent topic coverage when the same small item pool is repeated. This is one reason the project does not raise the Final target to 0.95 before reviewing real response data and considering repeat-item handling.

## Runtime limitation: bands do not currently filter served questions

The stage band is used in planning evidence paths:

- `lib/plan-state.ts` calls `difficultiesForStage()` and passes the result to answer-history and question-availability queries.
- `lib/plan-db.ts` filters mastery answer records by topic and difficulty and checks for at least one reviewed, non-archived question in the band to determine confirmation availability.
- `lib/progress-data.ts` uses the stage band for stage-specific progress estimates.

However, the topic quiz read path (`lib/quiz.ts`) and the server grading fetch (`lib/quiz-actions.ts`) currently retrieve all reviewed, non-archived questions for the topic, without applying the stage difficulty band. Therefore, do not tell students or agents that changing `STAGES[stage].difficulty` currently restricts the actual question set delivered or scored. Implementing stage-filtered quiz delivery and deciding whether attempts use every eligible item or a sampled subset are separate engineering decisions and are not part of the content-writing assignment.

## Scope and limitations

The 2025 papers provide direct evidence for one examination year only. They are used to calibrate preparation bands, not to claim a stable statistical distribution of difficulty or to establish official category labels. The Final section is identified as Final by elimination: the opening page says OSN 2025 Astronomy and announces eight essays, while the later sections are explicitly labelled Semifinal, Provincial and Regency/City. Preserve that qualification in any derivative analysis.

Writers must not receive or reuse the examination papers. They receive the repository, *Fundamental Astronomy* (6th ed.) and their own topic brief. Exam content, options, diagrams, tables and datasets are director-only calibration evidence and are not question sources.
