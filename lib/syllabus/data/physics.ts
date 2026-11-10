import { defineSyllabus, inSources, practical, section, topic } from "../define";
import type { SubjectSyllabus } from "../types";

// Two sources, listed in `sources` below. The FIRST (OSN) is the primary one:
// the planner, quiz bank and mastery estimates are built on its topics only, so
// every topic that is not in it (the IPhO-only ones) is invisible to them.
//
// OSN (Indonesian, official). English names of OSN topics are unofficial
// glosses. Transcribed from the "Cabang Fisika" scope table (Teori +
// Praktikum). That table has no per-level (OSK/OSP/OSN) marks, so none are
// modelled. Practical areas have no linkable topics, only the scope text copied
// from the table.
//
// IPhO (English, official). The IPhO syllabus says the level of each topic is
// to be judged from past papers, so no level is modelled here either. The
// IPhO-only topics below are named after the syllabus's own headings and carry
// no copied text; `refs` points at the section instead. Whether an OSN topic is
// ALSO in the IPhO syllabus is a heading-level judgement made by the project's
// owner (the OSN list is headings only), not something either source states:
// the pairing says "the same area", not "the same depth".
const MECHANICS_SCOPE =
  "Vektor, Kinematika, Statika, Dinamika, Energi dan Momentum, Momentum Sudut dan Benda Tegar, Gravitasi, Fluida, Osilasi, Gelombang";
const EM_SCOPE = "Listrik Statis, Magnet Statis, Rangkaian Listrik, Elektrodinamika";
const THERMO_SCOPE = "Suhu dan Kalor, Entropi, Hukum Termodinamika 0, I dan II";

// Shorthand: an OSN topic whose area the IPhO syllabus also covers.
const both = (entry: ReturnType<typeof topic>, ref: string) =>
  inSources(entry, ["osn", "ipho"], { ipho: ref });

export const physics: SubjectSyllabus = defineSyllabus({
  subject: "physics",
  sources: [
    {
      id: "osn",
      kind: "national",
      short: "OSN",
      label: "Panduan OSN SMA/MA/SMK/MAK/Sederajat — Silabus OSN, Cabang Fisika (Teori + Praktikum)",
      issuer: "Pusat Prestasi Nasional, Kemendikdasmen",
      edition: "OSN 2026",
      // The guide's landing page, which IA TOKI links as the OSN 2026 guideline.
      url: "https://pusatprestasinasional.kemendikdasmen.go.id/pengumuman/sd/panduan-osn-tahun-2026-2026-sd",
      language: "id",
      // `accessed` is deliberately unset: the guide's PDF host blocks automated
      // access, so these lists have NOT been compared with the 2026 PDF. What
      // was seen: the 2025 edition's appendix (primary, read in full) lists the
      // same ten mechanics headings as MECHANICS_SCOPE below. It words two
      // electricity-and-magnetism headings "Listrik Statik" and "Magnet
      // Statik", where this file says "Statis" (possibly the 2026 wording).
      // The 2026 text is known only from summaries. Set `accessed` once someone
      // has compared the lists with the 2026 PDF.
      verification: "secondary",
      note: {
        id: "Daftar ini belum dicocokkan dengan Panduan OSN 2026. Edisi 2025 dari lampiran yang sama sudah dibaca langsung dan memuat sepuluh judul mekanika yang sama; dua judul listrik-magnet di sana berbunyi “Statik”, bukan “Statis”.",
        en: "This list has not been compared with the 2026 OSN guide. The 2025 edition of the same appendix was read directly and gives the same ten mechanics headings; two electricity and magnetism headings read “Statik” there, not “Statis”.",
      },
    },
    {
      id: "ipho",
      kind: "international",
      short: "IPhO",
      label: "IPhO Syllabus (Appendix to the Statutes of the International Physics Olympiads)",
      issuer: "International Physics Olympiad",
      edition: "Accepted 2014 (Astana), amended 2015 (Mumbai)",
      // A host-country copy. The official copy (ipho-new.org) has not been
      // opened, so the check for a newer version is still open.
      url: "https://www.ipho2024.ir/en/files/2015_Syllabus_IPhO.pdf",
      language: "en",
      accessed: "2026-11-10",
      verification: "compared",
      note: {
        id: "Dibandingkan dengan salinan dari tuan rumah IPhO 2024, bukan salinan resmi di situs IPhO. Belum diperiksa apakah ada versi yang lebih baru dari 2015.",
        en: "Compared with a copy hosted by IPhO 2024, not the official copy on the IPhO site. Whether a version newer than 2015 exists has not been checked.",
      },
    },
  ],
  sections: [
    section("mechanics", "Mekanika", "Mechanics", [
      both(topic("vectors", "Vektor", "Vectors"), "§4.4"),
      both(topic("kinematics", "Kinematika", "Kinematics"), "§2.2.1"),
      both(topic("statics", "Statika", "Statics"), "§2.2.2"),
      both(topic("dynamics", "Dinamika", "Dynamics"), "§2.2.3"),
      both(topic("energy-momentum", "Energi dan Momentum", "Energy and momentum"), "§2.2.3"),
      both(topic("rotation-rigid-body", "Momentum Sudut dan Benda Tegar", "Angular momentum and rigid bodies"), "§2.2.3"),
      both(topic("gravitation", "Gravitasi", "Gravitation"), "§2.2.4"),
      both(topic("fluids", "Fluida", "Fluids"), "§2.2.5"),
      both(topic("oscillations", "Osilasi", "Oscillations"), "§2.4.1"),
      both(topic("waves", "Gelombang", "Waves"), "§2.4.2"),
    ]),
    section("electromagnetism", "Listrik Magnet", "Electricity and Magnetism", [
      both(topic("electrostatics", "Listrik Statis", "Electrostatics"), "§2.3.1–2.3.3"),
      both(topic("magnetostatics", "Magnet Statis", "Magnetostatics"), "§2.3.1–2.3.3"),
      both(topic("circuits", "Rangkaian Listrik", "Electric circuits"), "§2.3.4"),
      both(topic("electrodynamics", "Elektrodinamika", "Electrodynamics"), "§2.3.1–2.3.3"),
    ]),
    section("thermodynamics", "Termodinamika", "Thermodynamics", [
      both(topic("heat-temperature", "Suhu dan Kalor", "Temperature and heat"), "§2.7.1, §2.7.2"),
      both(topic("entropy", "Entropi", "Entropy"), "§2.7.1"),
      both(topic("laws-of-thermodynamics", "Hukum Termodinamika 0, I dan II", "Laws of thermodynamics (zeroth, first, second)"), "§2.7.1"),
      inSources(topic("statistical-physics", "Fisika Statistik", "Statistical physics"), ["ipho"], { ipho: "§2.7.3" }),
    ]),
    section("optics", "Optika", "Optics", [
      inSources(topic("interference-diffraction", "Interferensi dan Difraksi", "Interference and diffraction"), ["ipho"], { ipho: "§2.4.3" }),
      inSources(topic("em-waves-in-matter", "Interaksi Gelombang Elektromagnetik dengan Materi", "Interaction of electromagnetic waves with matter"), ["ipho"], { ipho: "§2.4.4" }),
      inSources(topic("geometrical-optics-photometry", "Optika Geometri dan Fotometri", "Geometrical optics and photometry"), ["ipho"], { ipho: "§2.4.5" }),
      inSources(topic("optical-devices", "Alat Optik", "Optical devices"), ["ipho"], { ipho: "§2.4.6" }),
    ]),
    section("modern-physics", "Fisika Modern", "Modern Physics", [
      inSources(topic("relativity", "Relativitas", "Relativity"), ["ipho"], { ipho: "§2.5" }),
      inSources(topic("probability-waves", "Gelombang Probabilitas", "Probability waves"), ["ipho"], { ipho: "§2.6.1" }),
      inSources(topic("structure-of-matter", "Struktur Materi", "Structure of matter"), ["ipho"], { ipho: "§2.6.2" }),
    ]),
    section("physics-mathematics", "Matematika dan Pemodelan", "Mathematics and Modelling", [
      inSources(topic("approximation-symmetry", "Pendekatan dan Simetri", "Approximation and symmetry"), ["ipho"], { ipho: "§2.1" }),
      inSources(topic("algebra", "Aljabar", "Algebra"), ["ipho"], { ipho: "§4.1" }),
      inSources(topic("functions", "Fungsi", "Functions"), ["ipho"], { ipho: "§4.2" }),
      inSources(topic("geometry-stereometry", "Geometri dan Stereometri", "Geometry and stereometry"), ["ipho"], { ipho: "§4.3" }),
      inSources(topic("complex-numbers", "Bilangan Kompleks", "Complex numbers"), ["ipho"], { ipho: "§4.5" }),
      inSources(topic("statistics", "Statistika", "Statistics"), ["ipho"], { ipho: "§4.6" }),
      inSources(topic("calculus", "Kalkulus", "Calculus"), ["ipho"], { ipho: "§4.7" }),
      inSources(topic("approximate-numerical-methods", "Metode Pendekatan dan Numerik", "Approximate and numerical methods"), ["ipho"], { ipho: "§4.8" }),
    ]),
    practical("practical-mechanics", "Praktikum: Mekanika", "Practical: Mechanics", MECHANICS_SCOPE),
    practical("practical-electromagnetism", "Praktikum: Listrik Magnet", "Practical: Electricity and Magnetism", EM_SCOPE),
    practical("practical-thermodynamics", "Praktikum: Termodinamika", "Practical: Thermodynamics", THERMO_SCOPE),
    practical("practical-modern-physics", "Praktikum: Fisika modern", "Practical: Modern physics"),
    {
      ...practical(
        "practical-experimental-skills",
        "Keterampilan Eksperimen",
        "Experimental skills",
        "IPhO §3 names these areas: safety; measurement techniques and apparatus; accuracy; experimental uncertainty analysis; data analysis.",
      ),
      in: ["ipho"],
    },
  ],
});
