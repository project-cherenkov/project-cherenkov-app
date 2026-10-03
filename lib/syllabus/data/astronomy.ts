import { section, topic } from "../define";
import type { SubjectSyllabus } from "../types";

// Source language: English (official). Indonesian names are unofficial glosses.
// Transcribed from the Junior IOAA syllabus page. `detail` strings follow the
// source's own "Contents / Remarks" columns, lightly normalised where the
// source was garbled (e.g. "Hoffman transfers" -> Hohmann, "angular
// enlargement" -> magnification, stray fragments joined into sentences).
// "(Q)" is the source's marker for "qualitative understanding only".
export const astronomy: SubjectSyllabus = {
  subject: "astronomy",
  sourceLang: "en",
  source: { label: "Junior IOAA Syllabus — IOAA" },
  sections: [
    section("basic-astrophysics", "Astronomi dan Astrofisika Dasar", "Basic Astronomy and Astrophysics", [
      topic("celestial-mechanics", "Mekanika Benda Langit", "Celestial mechanics",
        "Newton’s law of gravitation; Kepler’s laws for circular and non-circular orbits; the ellipse, its main points, semi-major and semi-minor axes, eccentricity; movements of planets, asteroids and comets; Roche limit, barycentre, two-body problem, Lagrange points."),
      topic("electromagnetic-theory", "Teori Elektromagnetik", "Electromagnetic theory",
        "Electromagnetic waves; visible light and its wavelengths; Doppler effect; Wien’s law; the electromagnetic spectrum (radio, UV, X-ray)."),
      topic("thermodynamics", "Termodinamika", "Thermodynamics",
        "Ideal gas; thermal equation of state; the caloric equation."),
      topic("spectroscopy-atomic-physics", "Spektroskopi dan Fisika Atom", "Spectroscopy and atomic physics",
        "Absorption (Q); emission; spectra of celestial objects (Q)."),
    ]),
    section("coordinates-times", "Koordinat dan Waktu", "Coordinates and Times", [
      topic("celestial-sphere", "Bola Langit", "The celestial sphere",
        "Spherical trigonometry; celestial coordinates and their applications; equinox and solstice; circumpolar stars; constellations and zodiac. Diurnal motion of stars and culmination; the planes, lines and notable points of the celestial sphere; horizontal and equatorial coordinate systems; altitude of the celestial pole above the horizon; diurnal motion of stars at different latitudes; altitude of a star at culmination; circumpolar stars and stars that rise and set."),
      topic("concept-of-time", "Konsep Waktu", "The concept of time",
        "Solar time; sidereal time; Julian date; heliocentric Julian date; time zones; Universal Time; local mean time; different definitions of “year”; equation of time. Time measurement, calendars, and the bases of time measurement."),
    ]),
    section("solar-system", "Tata Surya", "Solar System", [
      topic("the-sun", "Matahari", "The Sun",
        "Solar structure; solar surface activity; solar rotation; solar radiation and the solar constant; Sun–Earth relations; role of magnetic fields (Q); solar wind and radiation pressure; heliosphere (Q); magnetosphere (Q)."),
      topic("solar-system-bodies", "Benda-benda Tata Surya", "The Solar System",
        "The Sun–Earth–Moon system: phases, eclipses of the Moon and Sun, the Earth’s motion around the Sun and the Moon’s around the Earth, precession of the Earth’s axis. Formation and evolution of the Solar System (Q); structure and components (Q); structure and orbits of Solar System objects; sidereal and synodic periods and the relation between them; retrograde motion; outer reaches of the Solar System (Q). Parallax and distances; size, shape, mass and average density of bodies; albedo; the astronomical unit; angular dimensions and small angles. Apparent motions of the planets and the Sun on the celestial sphere; planetary configurations; variation of the Sun’s declination and right ascension through the year; seasonal variations in the appearance of the starry sky."),
      topic("solar-system-phenomena", "Fenomena Tata Surya", "Phenomena",
        "Tides; seasons; eclipses; aurorae (Q); meteor showers; atmospheric refraction and its effect on observations."),
    ]),
    section("stars", "Bintang", "Stars", [
      topic("stellar-properties", "Sifat-sifat Bintang", "Stellar properties",
        "Methods of distance determination; annual parallax; radiation, luminosity and magnitude; determination of radii and masses; stellar motion; irregular and regular stellar variability (broad classification and properties); Cepheids and the period–luminosity relation."),
      topic("stellar-evolution", "Evolusi Bintang", "Stellar evolution",
        "Stellar formation; Hertzsprung–Russell diagram; pre-main-sequence, main-sequence and post-main-sequence stars; supernovae; planetary nebulae; end states of stars."),
    ]),
    section("stellar-systems", "Sistem Bintang", "Stellar Systems", [
      topic("binary-stars", "Bintang Ganda", "Binary star systems",
        "Different types of binary stars; mass determination in binary systems; light and radial-velocity curves of eclipsing binaries; Doppler shifts in binary systems; interacting binaries; peculiar binary systems."),
      topic("star-clusters", "Gugus Bintang", "Star clusters",
        "Classification and structure; mass, age, luminosity and distance determination."),
      topic("milky-way", "Galaksi Bima Sakti", "The Milky Way",
        "Structure and composition; rotation; satellites of the Milky Way (Q)."),
      topic("galaxies", "Galaksi", "Galaxies",
        "Classification by structure, composition and activity; mass, luminosity and distance determination; rotation curves; the Sun’s motion and general notions about our Galaxy; the Solar System’s movement in the Galaxy."),
    ]),
    section("cosmology", "Kosmologi", "Cosmology", [
      topic("elementary-cosmology", "Kosmologi Dasar", "Elementary cosmology",
        "Expanding Universe and Hubble’s law; clusters of galaxies; Big Bang (Q); the Schwarzschild radius formula. Speed of light; the distance ladder; length units from the metre to the gigaparsec; general knowledge of the structure of the Universe."),
    ]),
    section("space-sciences", "Sains Antariksa Dasar", "Basic Space Sciences", [
      topic("exoplanets", "Eksoplanet", "Exoplanets",
        "Techniques used to detect exoplanets."),
      topic("cosmonautics", "Kosmonautika", "Cosmonautics",
        "Cosmic velocities; forms of orbits; the ecliptic coordinate system; tilt and line of nodes; speed at perihelion and aphelion; determination of circular orbits; perturbations of planetary motion; tidal effects; determining the masses of celestial bodies; elementary calculations of Earth’s orbits to nearby planets."),
      topic("space-exploration", "Eksplorasi Antariksa", "Space exploration",
        "Satellite trajectories and Hohmann transfers; human exploration of the Solar System (Q); planetary missions (Q); gravitational sling-shot effect; space-based instruments (Q)."),
      topic("instrumentation", "Instrumentasi", "Instrumentation",
        "Fundamentals of geometric optics; the eye as an optical device; construction of the simplest observing tools; refractors and reflectors; photo camera; binoculars; image formation in optical devices; angular magnification."),
    ]),
  ],
};
