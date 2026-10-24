import { practical, section, topic } from "../define";
import type { SubjectSyllabus } from "../types";

// Source language: English (official). Indonesian names are unofficial glosses.
// Transcribed from the IOAA (senior) syllabus published by the International
// Olympiad on Astronomy and Astrophysics, compared with the page on
// 2026-10-24. This is deliberately NOT the Junior IOAA syllabus this file used
// before: the Ministry's OSN guide (2025 appendix text, seen via a third-party
// copy) says OSN astronomy follows the IOAA syllabus, and a summary of the 2026
// appendix lists topics from the senior one (basic astrophysics, solar system,
// coordinate systems, estimation, statistics and error analysis). The 2026
// PDF itself could not be opened, so re-check this against its appendix.
//
// `detail` strings follow the source's own "Contents" column, normalised only
// for punctuation. "(Q)" is the source's marker for "qualitative understanding
// only". The source's general remarks: SI units are used unless stated, and
// standard solutions need no complex numbers or differential equations.
//
// Topic ids that existed under the Junior transcription are kept (planner rows
// and the quiz bank point at them). Dropped because the senior syllabus has no
// counterpart: the "space-sciences" section and its "cosmonautics" topic.
// "exoplanets" and "space-exploration" moved to the sections where the senior
// syllabus lists them.
export const astronomy: SubjectSyllabus = {
  subject: "astronomy",
  sourceLang: "en",
  source: {
    label: "IOAA Syllabus — International Olympiad on Astronomy and Astrophysics",
    url: "https://ioaastrophysics.org/resources/IOAA%20Syllabus",
    accessed: "2026-10-24",
  },
  sections: [
    section("basic-astrophysics", "Astrofisika Dasar", "Basic Astrophysics", [
      topic("celestial-mechanics", "Mekanika Benda Langit", "Celestial mechanics",
        "Newton’s law of gravitation; Kepler’s laws for circular and non-circular orbits; Roche limit; barycentre; two-body problem; Lagrange points."),
      topic("electromagnetic-theory", "Teori Elektromagnetik dan Fisika Kuantum", "Electromagnetic theory and quantum physics",
        "Electromagnetic spectrum; radiation laws; blackbody radiation."),
      topic("thermodynamics", "Termodinamika", "Thermodynamics",
        "Thermodynamic equilibrium; ideal gas; energy transfer."),
      topic("spectroscopy-atomic-physics", "Spektroskopi dan Fisika Atom", "Spectroscopy and atomic physics",
        "Absorption, emission and scattering; spectra of celestial objects; Doppler effect; line formation; continuum spectra; splitting and broadening of spectral lines; polarisation."),
      topic("nuclear-physics", "Fisika Nuklir", "Nuclear physics",
        "Basic concepts, including the structure of the atom; mass defect and binding energy; radioactivity; neutrinos (Q)."),
    ]),
    section("mathematical-methods", "Metode dan Alat Matematika", "Mathematical Methods and Tools", [
      topic("numerical-methods", "Metode Numerik", "Numerical methods",
        "Linearisation of equations and expressions; iterative solving of functions; estimating the area under a curve by a graphical method, by integration or by numerical approximation; Taylor-series approximations of common functions."),
      topic("basic-calculus", "Kalkulus Dasar", "Basic calculus",
        "Derivatives of elementary functions and of their sums, products, quotients and nested functions; integration as the inverse of differentiation; definite and indefinite integrals of elementary functions and their sums; geometric interpretation of derivatives and integrals; finding constants of integration from initial conditions."),
      topic("vectors", "Vektor", "Vectors",
        "Basic properties of vector sums, dot products and cross products; geometric interpretation of the time derivative of a vector quantity."),
      topic("geometric-instruments", "Alat Geometri", "Geometric instruments",
        "Use of a ruler, geometric compass, protractor and set-square."),
      topic("statistics-error-analysis", "Statistika dan Analisis Galat", "Statistics and error analysis",
        "Mean, median, mode and percentiles; box plots; standard deviation; basic probability; relative errors; error estimation using the maximum error or the standard error."),
    ]),
    section("coordinates-times", "Koordinat dan Waktu", "Coordinates and Times", [
      topic("celestial-sphere", "Bola Langit", "The celestial sphere",
        "Spherical trigonometry; celestial coordinates and their applications; equinox and solstice; circumpolar stars; constellations and zodiac. Azimuth is measured from 0° to 360° starting from north and increasing towards east, unless stated otherwise."),
      topic("concept-of-time", "Konsep Waktu", "The concept of time",
        "Solar time; sidereal time; Julian date; heliocentric Julian date; time zones; Universal Time; local mean time; different definitions of “year”; equation of time."),
    ]),
    section("solar-system", "Tata Surya", "Solar System", [
      topic("the-sun", "Matahari", "The Sun",
        "Solar structure; solar surface activity; solar rotation; solar radiation and the solar constant; solar neutrinos (Q); Sun–Earth relations; role of magnetic fields (Q); solar wind and radiation pressure; heliosphere (Q); magnetosphere (Q)."),
      topic("solar-system-bodies", "Benda-benda Tata Surya", "The Solar System",
        "Earth–Moon system; precession; nutation; libration; formation and evolution of the Solar System (Q); structure and components of the Solar System (Q); structure and orbits of Solar System objects; sidereal and synodic periods; retrograde motion; outer reaches of the Solar System (Q)."),
      topic("space-exploration", "Eksplorasi Antariksa", "Space exploration",
        "Satellite trajectories and transfers; human exploration of the Solar System (Q); planetary missions (Q); gravitational sling-shot effect; space-based instruments (Q)."),
      topic("solar-system-phenomena", "Fenomena Tata Surya", "Phenomena",
        "Tides; seasons; factors influencing climate (Q); eclipses; aurorae and space weather (Q); meteor showers."),
    ]),
    section("stars", "Bintang", "Stars", [
      topic("stellar-properties", "Sifat-sifat Bintang", "Stellar properties",
        "Methods of distance determination; radiation, luminosity and magnitude; colour indices and temperature; determination of radii and masses; stellar motion; irregular and regular stellar variability (broad classification and properties); Cepheids and the period–luminosity relation; physics of pulsation (Q)."),
      topic("stellar-interiors-atmospheres", "Interior dan Atmosfer Bintang", "Stellar interiors and atmospheres",
        "Stellar equilibrium; stellar nucleosynthesis; energy transport (Q); boundary conditions; stellar atmospheres and atmospheric spectra."),
      topic("stellar-evolution", "Evolusi Bintang", "Stellar evolution",
        "Stellar formation; Hertzsprung–Russell diagram; pre-main-sequence, main-sequence and post-main-sequence stars; supernovae; planetary nebulae; end states of stars."),
    ]),
    section("stellar-systems", "Sistem Bintang", "Stellar Systems", [
      topic("binary-stars", "Bintang Ganda", "Binary star systems",
        "Different types of binary stars; mass determination in binary systems; light and radial-velocity curves of eclipsing binaries; Doppler shifts in binary systems; interacting binaries; peculiar binary systems."),
      topic("exoplanets", "Eksoplanet", "Exoplanets",
        "Techniques used to detect exoplanets; habitable zone; classes of exoplanets (Q); spectral signatures of possible life (Q)."),
      topic("star-clusters", "Gugus Bintang", "Star clusters",
        "Classification and structure; mass, age, luminosity and distance determination."),
      topic("milky-way", "Galaksi Bima Sakti", "The Milky Way",
        "Structure and composition; rotation; satellites of the Milky Way (Q)."),
      topic("interstellar-medium", "Medium Antarbintang", "Interstellar medium",
        "Gas (Q); dust (Q); HII regions; 21 cm radiation; nebulae (Q); interstellar absorption; dispersion measure; Faraday rotation."),
      topic("galaxies", "Galaksi", "Galaxies",
        "Classification by structure, composition and activity; mass, luminosity and distance determination; rotation curves."),
      topic("accretion-processes", "Proses Akresi", "Accretion processes",
        "Basic concepts of spherical and disc accretion (Q); Eddington luminosity."),
    ]),
    section("cosmology", "Kosmologi", "Cosmology", [
      topic("elementary-cosmology", "Kosmologi Dasar", "Elementary cosmology",
        "Expanding Universe and Hubble’s law; clusters of galaxies; dark matter; dark energy (Q); gravitational lensing; cosmic microwave background radiation; Big Bang (Q); alternative models of the Universe (Q); large-scale structure (Q); distance measurement at cosmological scales; cosmological redshift."),
    ]),
    section("instrumentation-space-technologies", "Instrumentasi dan Teknologi Antariksa", "Instrumentation and Space Technologies", [
      topic("multi-wavelength-astronomy", "Astronomi Multi-panjang Gelombang", "Multi-wavelength astronomy",
        "Observations in the radio, microwave, infrared, visible, ultraviolet, X-ray and gamma-ray bands; effects of the Earth’s atmosphere; artificial light and electromagnetic pollution."),
      topic("instrumentation", "Instrumentasi", "Instrumentation",
        "Telescopes and detectors (for example CCDs, photometers and spectrographs); magnification; focal length; focal ratio; resolving and light-gathering power of telescopes; geometric model of a two-element interferometer; aperture synthesis; adaptive optics; photometry; astrometry."),
    ]),
    practical("practical-observations", "Praktikum: Pengamatan", "Practical: Observations",
      "Naked-eye observations; use of sky maps and catalogues (a star named rather than given by Bayer designation or catalogue number must be on the IAU-approved star-name list, and knowing the whole list is not required); application of coordinate systems on the sky; magnitude estimation; estimation of angular separation; use of basic astronomical instruments (telescopes and various detectors), with enough instructions provided. Observed objects may be real sources in the sky or imitated sources in the laboratory; computer simulations may be used."),
    practical("practical-data-analysis", "Praktikum: Analisis Data", "Practical: Data analysis",
      "Calculation and analysis of the astronomical data given in the problems. Additional requirements: proper identification of error sources; proper use of graph paper with different scales (for example polar and logarithmic) and finding an approximate “best fit” line; familiarity with basic geometric instruments (ruler, compass, protractor, set-square); knowledge of the most common experimental techniques for measuring the physical quantities in the theory part."),
  ],
};
