import { practical, section, topic } from "../define";
import type { SubjectSyllabus } from "../types";

// Source language: Indonesian (official). English names are unofficial glosses.
// Transcribed from the "Cabang Fisika" scope table (Teori + Praktikum). That
// table has no per-level (OSK/OSP/OSN) marks, so none are modelled. Practical
// areas have no linkable topics, only the scope text copied from the table.
const MECHANICS_SCOPE =
  "Vektor, Kinematika, Statika, Dinamika, Energi dan Momentum, Momentum Sudut dan Benda Tegar, Gravitasi, Fluida, Osilasi, Gelombang";
const EM_SCOPE = "Listrik Statis, Magnet Statis, Rangkaian Listrik, Elektrodinamika";
const THERMO_SCOPE = "Suhu dan Kalor, Entropi, Hukum Termodinamika 0, I dan II";

export const physics: SubjectSyllabus = {
  subject: "physics",
  sourceLang: "id",
  // Confirmed by the project owner as coming from the official OSN guidebook.
  // The exact title, edition and URL were not given — add `edition` / `url`
  // here once known rather than guessing them.
  source: { label: "Official OSN guidebook — \"Cabang Fisika\" scope table (Teori + Praktikum)" },
  sections: [
    section("mechanics", "Mekanika", "Mechanics", [
      topic("vectors", "Vektor", "Vectors"),
      topic("kinematics", "Kinematika", "Kinematics"),
      topic("statics", "Statika", "Statics"),
      topic("dynamics", "Dinamika", "Dynamics"),
      topic("energy-momentum", "Energi dan Momentum", "Energy and momentum"),
      topic("rotation-rigid-body", "Momentum Sudut dan Benda Tegar", "Angular momentum and rigid bodies"),
      topic("gravitation", "Gravitasi", "Gravitation"),
      topic("fluids", "Fluida", "Fluids"),
      topic("oscillations", "Osilasi", "Oscillations"),
      topic("waves", "Gelombang", "Waves"),
    ]),
    section("electromagnetism", "Listrik Magnet", "Electricity and Magnetism", [
      topic("electrostatics", "Listrik Statis", "Electrostatics"),
      topic("magnetostatics", "Magnet Statis", "Magnetostatics"),
      topic("circuits", "Rangkaian Listrik", "Electric circuits"),
      topic("electrodynamics", "Elektrodinamika", "Electrodynamics"),
    ]),
    section("thermodynamics", "Termodinamika", "Thermodynamics", [
      topic("heat-temperature", "Suhu dan Kalor", "Temperature and heat"),
      topic("entropy", "Entropi", "Entropy"),
      topic("laws-of-thermodynamics", "Hukum Termodinamika 0, I dan II", "Laws of thermodynamics (zeroth, first, second)"),
    ]),
    practical("practical-mechanics", "Praktikum: Mekanika", "Practical: Mechanics", MECHANICS_SCOPE),
    practical("practical-electromagnetism", "Praktikum: Listrik Magnet", "Practical: Electricity and Magnetism", EM_SCOPE),
    practical("practical-thermodynamics", "Praktikum: Termodinamika", "Practical: Thermodynamics", THERMO_SCOPE),
    practical("practical-modern-physics", "Praktikum: Fisika modern", "Practical: Modern physics"),
  ],
};
