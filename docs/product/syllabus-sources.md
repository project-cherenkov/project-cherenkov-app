# Syllabus sources

> Moved from docs/syllabus-sources.md on 2026-11-08.

Where the topic lists in `lib/syllabus/data/*.ts` come from, and how far each
was checked. All "accessed" dates are 24 October 2026.

| Subject | Primary source | Checked against it | Status |
| --- | --- | --- | --- |
| Informatics | IA TOKI, *Silabus OSN* | Yes, topic by topic (10 sections, 51 topics) | Matches |
| Astronomy | IOAA Syllabus (senior) | Yes, section by section | Matches (was Junior IOAA before) |
| Physics | Ministry OSN guide, syllabus appendix | **No** — PDF host blocks automated access | Unverified for 2026 |

## Update, 2026-11-10

Each subject now has a source registry in code (`lib/syllabus/data/*.ts`), shown on the syllabus pages.

| Subject | Sources (first = primary) | Status |
| --- | --- | --- |
| Physics | OSN guide (2026 list, `accessed` unset: **secondary** only); IPhO syllabus 2014/2015 (compared 2026-11-10 on the host copy `ipho2024.ir`; official copy not opened) | 17 OSN topics, 5 of the IPhO headings paired by owner judgement at heading level, 16 IPhO-only topics added |
| Informatics | IA TOKI list (compared 2026-10-24); IOI syllabus, version used for IOI 2025 (compared 2026-11-10) | 53 topics also in IOI with the IOI's own code; `number-theory`, `probability`, `simple-sorts`, `weighted-graphs` and `modular-exponentiation` left OSN-only because the IOI text does not name them as included |
| Astronomy | IOAA syllabus (compared 2026-10-24); OSN 2025 guide (says astronomy follows IOAA; it lists no topics) | every topic lists both, with the guide's note shown |

Still to do by hand: compare the 2026 OSN guide's physics and informatics appendix with the data; open the official IPhO page; check for an IOI 2026 version; redo a topic-by-topic IOAA comparison if a current date is wanted. The IOI's six categories (included, outside focus, excluded, …) are not modelled.

## What is and isn't confirmed

- **Informatics.** The IA TOKI page says it follows the IOI syllabus "with
  various adjustments". The OSN-P page says its material refers to the whole OSN
  syllabus. The OSN-K page lists only non-exhaustive themes, so no per-level
  flags are modelled (see the comment in `informatics.ts`). The official IOI
  syllabus page still shows the 2025 PDF as current.
- **Astronomy.** The Ministry's 2025 appendix text (seen via a third-party
  copy, reference 5) says OSN astronomy follows the IOAA syllabus; a summary of
  the 2026 appendix (reference 1) lists topics from the senior syllabus. The
  Junior IOAA syllabus (reference 9) is for early high-school students and is
  narrower, so it is not the OSN reference.
- **Physics.** The 2025 appendix text gives the mechanics list verbatim as in
  `MECHANICS_SCOPE`. The electricity-and-magnetism and thermodynamics scope
  strings and the four practical areas come from the owner's transcription and
  have not been compared with a readable copy. A Tirto summary of the 2026
  appendix words the physics topics differently
  ("Kinematika, Dinamika Linier, Dinamika Rotasi, Gravitasi, Listrik Magnet,
  Termofisika"); that is probably a paraphrase, but check it against the PDF.
  When someone has done that, set `source.accessed` in `physics.ts`.

## Reference list

Ministry of Education (Indonesia)

1. Pusat Prestasi Nasional, Kemendikdasmen. *Panduan OSN SMA/MA/SMK/MAK/Sederajat
   2026*, Lampiran 3 "Silabus OSN". Not opened (automated access blocked); known
   through summaries at
   https://tirto.id/link-unduh-kumpulan-materi-silabus-osn-sma-2026-pdf-hqCC and
   https://tirto.id/bank-soal-osn-sma-2026-materi-dan-link-unduh-pdf-huQY.
   Accessed 24 Oct 2026 (summaries only).
2. Pusat Prestasi Nasional. *Adendum Panduan OSN 2026 Jenjang Dikmen*.
   https://pusatprestasinasional.kemendikdasmen.go.id/uploads/lampiran/Adendum%20Panduan%20OSN%202026%20Jenjang%20DIKMEN.pdf
   Search snippet only. Accessed 24 Oct 2026.
3. Pusat Prestasi Nasional. *Pedoman OSN SMA/MA/Sederajat 2024*. Read in full;
   it has no syllabus appendix. Accessed 24 Oct 2026.
4. Direktorat Pembinaan SMA, Kemendikbud. *Silabus OSN 2017 Fisika*, e.g.
   https://sma.dikdasmen.go.id/data/files/silabus/2.%20Silabus%20OSN%202017%20Fisika.pdf
   Historical only (shows the IPhO basis of the older physics syllabus).
   Accessed 24 Oct 2026 (search snippet).
5. *Silabus OSN 2025 untuk SMA* (text of the 2025 guide's Appendix 3), third-party
   copy: https://www.scribd.com/document/850766579/Silabus-Osn-Sma-2025
   Accessed 24 Oct 2026 (search snippet; the page itself did not load).

National body, informatics

6. IA TOKI. *OSN Bidang Informatika — Silabus* (OSN, OSN-K, OSN-P).
   https://osn.toki.id/silabus, https://osn.toki.id/silabus/kota,
   https://osn.toki.id/silabus/provinsi. Accessed 24 Oct 2026.

International olympiad bodies

7. IOI. *The IOI Syllabus*. https://ioinformatics.org/page/syllabus (official
   page; PDF https://ioinformatics.org/files/ioi-syllabus-2025.pdf). Accessed
   24 Oct 2026.
8. IOAA. *IOAA Syllabus*. https://ioaastrophysics.org/resources/IOAA%20Syllabus
   Accessed 24 Oct 2026.
9. IOAA. *Junior IOAA Syllabus*.
   https://ioaastrophysics.org/junior-ioaa/junior-ioaa-syllabus
   Accessed 24 Oct 2026.
10. IPhO. *Appendix to the Statutes: IPhO Syllabus*. Read on host-country copies
    (https://www.ipho2021.lt/en/syllabus/, https://www.ipho2024.ir/en/files/2015_Syllabus_IPhO.pdf),
    not on the official IPhO site. Accessed 24 Oct 2026 (search snippets).
