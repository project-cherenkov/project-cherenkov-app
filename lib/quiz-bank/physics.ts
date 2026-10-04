import { defineBank } from "./define";

// STATUS: every question below is an AI-generated DRAFT written to exercise the
// quiz pipeline — one per (topic, difficulty) for all 17 physics topics. They
// were not reviewed by an editor: the answer keys of the numeric ones were
// recomputed, but the difficulty labels are the generator's estimate, and the
// wording is English only. Editors replace or approve them (status: "reviewed").
// Constants: g = 10 m/s² unless a question says otherwise.
export const physicsQuestions = defineBank("physics", [
  // ---- Mechanics --------------------------------------------------------
  {
    topic: "vectors", d: "basic",
    q: "Two perpendicular vectors of magnitudes 3 and 4 are added. What is the magnitude of the resultant?",
    c: ["1", "5", "7", "12"], a: 1,
    why: "For perpendicular vectors the magnitude is √(3² + 4²) = 5.",
  },
  {
    topic: "vectors", d: "intermediate",
    q: "Vectors A and B have magnitudes 2 and 5, with an angle of 30° between them. What is |A × B|?",
    c: ["10", "8.66", "5", "0"], a: 2,
    why: "|A × B| = AB sin θ = 2 · 5 · sin 30° = 5. The value 8.66 would be AB cos θ, which is the dot product.",
  },
  {
    topic: "vectors", d: "advanced",
    q: "For A = (1, 2, 2) and B = (2, −1, 2), what is cos θ, where θ is the angle between them?",
    c: ["2/3", "1/3", "4/9", "8/9"], a: 2,
    why: "A·B = 2 − 2 + 4 = 4 and |A| = |B| = 3, so cos θ = 4/9.",
  },
  {
    topic: "kinematics", d: "basic",
    q: "A car starts from rest and accelerates uniformly at 2 m/s² for 5 s. How far does it travel?",
    c: ["10 m", "25 m", "50 m", "5 m"], a: 1,
    why: "s = ½at² = ½ · 2 · 5² = 25 m.",
  },
  {
    topic: "kinematics", d: "intermediate",
    q: "Ignoring air resistance, why do launch angles of 30° and 60° (same speed) produce the same range?",
    c: [
      "Because both angles give the same maximum height",
      "Because sin(2·30°) = sin(2·60°)",
      "Because gravity acts differently at each angle",
      "Because the speed automatically adjusts to match",
    ],
    a: 1,
    why: "Range R = v² sin(2θ)/g, and sin 60° = sin 120°, so the ranges are equal even though the trajectories differ.",
  },
  {
    topic: "kinematics", d: "advanced",
    q: "A ball is thrown straight up at 20 m/s (g = 10 m/s²). What total distance has it travelled after 3 s?",
    c: ["15 m", "20 m", "25 m", "30 m"], a: 2,
    why: "It rises for 2 s to 20 m, then falls for 1 s through 5 m: 25 m travelled. The displacement is only 15 m.",
  },
  {
    topic: "statics", d: "basic",
    q: "A 40 kg child sits 1.5 m from the pivot of a seesaw. What mass must sit 1.0 m from the pivot on the other side to balance it?",
    c: ["20 kg", "40 kg", "60 kg", "80 kg"], a: 2,
    why: "Torques balance: 40 · 1.5 = m · 1.0, so m = 60 kg.",
  },
  {
    topic: "statics", d: "intermediate",
    q: "A 100 N weight hangs from the midpoint of a light cable whose two halves each make 30° with the horizontal. What is the tension in each half?",
    c: ["50 N", "86.6 N", "100 N", "200 N"], a: 2,
    why: "Vertically, 2T sin 30° = 100 N, so T = 100 N.",
  },
  {
    topic: "statics", d: "advanced",
    q: "A uniform ladder of weight W leans against a frictionless wall at angle θ above the horizontal floor. What is the least coefficient of static friction at the floor that prevents slipping?",
    c: ["tan θ / 2", "1 / tan θ", "1 / (2 tan θ)", "2 tan θ"], a: 2,
    why: "Torques about the foot: N_wall · L sin θ = W · (L/2) cos θ, so N_wall = (W/2) cot θ. Friction must equal N_wall while the normal force is W, so μ ≥ cot θ / 2 = 1/(2 tan θ).",
  },
  {
    topic: "dynamics", d: "basic",
    q: "A net force of 10 N acts on a 2 kg mass. What is its acceleration?",
    c: ["0.2 m/s²", "12 m/s²", "20 m/s²", "5 m/s²"], a: 3,
    why: "a = F/m = 10/2 = 5 m/s².",
  },
  {
    topic: "dynamics", d: "intermediate",
    q: "Masses of 3 kg and 1 kg hang from the two ends of a string over a light, frictionless pulley (Atwood machine). What is the acceleration of the masses?",
    c: ["2.5 m/s²", "5 m/s²", "7.5 m/s²", "10 m/s²"], a: 1,
    why: "a = (m₁ − m₂)g/(m₁ + m₂) = (2/4) · 10 = 5 m/s².",
  },
  {
    topic: "dynamics", d: "advanced",
    q: "A 2 kg block on a frictionless 30° incline is pushed by a horizontal force F so that it moves up the incline at constant velocity. What is F?",
    c: ["10 N", "11.5 N", "17.3 N", "20 N"], a: 1,
    why: "Along the incline: F cos 30° = mg sin 30°, so F = mg tan 30° ≈ 11.5 N. (17.3 N is mg cos 30°, the normal component.)",
  },
  {
    topic: "energy-momentum", d: "basic",
    q: "What is the kinetic energy of a 2 kg object moving at 3 m/s?",
    c: ["6 J", "3 J", "18 J", "9 J"], a: 3,
    why: "KE = ½mv² = ½ · 2 · 9 = 9 J.",
  },
  {
    topic: "energy-momentum", d: "intermediate",
    q: "A ball is dropped from rest from a height of 5 m. What is its speed just before it hits the ground? (g = 10 m/s², no air resistance)",
    c: ["5 m/s", "7.1 m/s", "10 m/s", "50 m/s"], a: 2,
    why: "mgh = ½mv², so v = √(2gh) = √100 = 10 m/s.",
  },
  {
    topic: "energy-momentum", d: "advanced",
    q: "A 2 kg block moving at 6 m/s collides and sticks to a stationary 4 kg block. What fraction of the initial kinetic energy is lost?",
    c: ["1/3", "1/2", "2/3", "3/4"], a: 2,
    why: "Momentum gives v = 12/6 = 2 m/s. KE goes from 36 J to 12 J, so 24/36 = 2/3 is lost.",
  },
  {
    topic: "rotation-rigid-body", d: "basic",
    q: "A 20 N force is applied perpendicular to a wrench at 0.5 m from the bolt. What is the torque?",
    c: ["40 N·m", "10 N·m", "20 N·m", "0.025 N·m"], a: 1,
    why: "τ = rF = 0.5 · 20 = 10 N·m.",
  },
  {
    topic: "rotation-rigid-body", d: "intermediate",
    q: "A spinning skater pulls in her arms so that her moment of inertia halves. Her angular velocity…",
    c: ["stays the same", "halves", "doubles", "quadruples"], a: 2,
    why: "Angular momentum Iω is conserved, so halving I doubles ω.",
  },
  {
    topic: "rotation-rigid-body", d: "advanced",
    q: "A solid disc (I = ½MR²) rolls without slipping from rest down an incline, dropping a height h. What is its speed at the bottom?",
    c: ["√(2gh)", "√(3gh/2)", "√(gh)", "√(4gh/3)"], a: 3,
    why: "mgh = ½mv² + ½(½mR²)(v/R)² = ¾mv², so v = √(4gh/3).",
  },
  {
    topic: "gravitation", d: "basic",
    q: "At a height above Earth's surface equal to Earth's radius R (distance 2R from the centre), the gravitational acceleration is…",
    c: ["g/2", "g/4", "g", "g/8"], a: 1,
    why: "g ∝ 1/r², and the distance has doubled, so g/4.",
  },
  {
    topic: "gravitation", d: "intermediate",
    q: "Planet X orbits a star at 4 times the orbital radius of planet Y. What is the ratio T_X / T_Y of their periods?",
    c: ["4", "16", "8", "64"], a: 2,
    why: "Kepler's third law: T² ∝ r³, so T ∝ r^(3/2) = 4^(3/2) = 8.",
  },
  {
    topic: "gravitation", d: "advanced",
    q: "A satellite of mass m moves in a circular orbit of radius r around a mass M. What is its total mechanical energy?",
    c: ["−GMm/r", "+GMm/(2r)", "0", "−GMm/(2r)"], a: 3,
    why: "KE = GMm/(2r) and PE = −GMm/r, so E = −GMm/(2r).",
  },
  {
    topic: "fluids", d: "basic",
    q: "What is the gauge pressure at 10 m depth in water? (ρ = 1000 kg/m³, g = 10 m/s²)",
    c: ["1 × 10³ Pa", "1 × 10⁴ Pa", "1 × 10⁶ Pa", "1 × 10⁵ Pa"], a: 3,
    why: "P = ρgh = 1000 · 10 · 10 = 1 × 10⁵ Pa.",
  },
  {
    topic: "fluids", d: "intermediate",
    q: "Water flows steadily through a pipe whose diameter halves along its length. By what factor does the flow speed change?",
    c: ["×2", "×1/2", "×4", "×1/4"], a: 2,
    why: "Continuity: Av is constant and A ∝ d², so the speed increases by 4.",
  },
  {
    topic: "fluids", d: "advanced",
    q: "A wooden block of volume 1000 cm³ and density 600 kg/m³ is held fully under water by a string tied to the bottom. What is the tension in the string? (ρ_water = 1000 kg/m³, g = 10 m/s²)",
    c: ["4 N", "6 N", "10 N", "16 N"], a: 0,
    why: "Buoyant force = 1000 · 10⁻³ · 10 = 10 N, weight = 600 · 10⁻³ · 10 = 6 N, so T = 10 − 6 = 4 N.",
  },
  {
    topic: "oscillations", d: "basic",
    q: "A mass on a spring oscillates with period T. If the mass is increased to 4 times its value, the period becomes…",
    c: ["T/2", "T", "4T", "2T"], a: 3,
    why: "T = 2π√(m/k), so quadrupling m doubles T.",
  },
  {
    topic: "oscillations", d: "intermediate",
    q: "A simple pendulum 1 m long swings where g = π² m/s² (≈ 9.87). What is its period?",
    c: ["1 s", "2 s", "π s", "2π s"], a: 1,
    why: "T = 2π√(L/g) = 2π√(1/π²) = 2 s.",
  },
  {
    topic: "oscillations", d: "advanced",
    q: "A mass m is attached to two identical springs, each of constant k, joined end to end (in series). What is the angular frequency of small oscillations?",
    c: ["√(k/m)", "√(2k/m)", "√(k/(2m))", "2√(k/m)"], a: 2,
    why: "Two identical springs in series have effective constant k/2, so ω = √(k/(2m)).",
  },
  {
    topic: "waves", d: "basic",
    q: "A wave has frequency 50 Hz and wavelength 2 m. What is its speed?",
    c: ["25 m/s", "52 m/s", "0.04 m/s", "100 m/s"], a: 3,
    why: "v = fλ = 50 · 2 = 100 m/s.",
  },
  {
    topic: "waves", d: "intermediate",
    q: "A string of length L is fixed at both ends. What is the wavelength of its fundamental standing wave?",
    c: ["L/2", "L", "2L", "4L"], a: 2,
    why: "The fundamental fits half a wavelength between the fixed ends: L = λ/2, so λ = 2L.",
  },
  {
    topic: "waves", d: "advanced",
    q: "A source at rest emits sound at 680 Hz. An observer moves toward it at 34 m/s. Taking the speed of sound as 340 m/s, what frequency does the observer hear?",
    c: ["612 Hz", "680 Hz", "748 Hz", "756 Hz"], a: 2,
    why: "f′ = f(v + v_obs)/v = 680 · 374/340 = 748 Hz. (756 Hz would be the case of a moving source.)",
  },
  // ---- Electricity and magnetism ----------------------------------------
  {
    topic: "electrostatics", d: "basic",
    q: "The distance between two point charges is doubled. The electrostatic force between them becomes…",
    c: ["F/2", "F/4", "2F", "4F"], a: 1,
    why: "Coulomb's law: F ∝ 1/r², so doubling r divides F by 4.",
  },
  {
    topic: "electrostatics", d: "intermediate",
    q: "In a uniform electric field of 200 N/C, what is the potential difference between two points 0.5 m apart along the field direction?",
    c: ["400 V", "100 V", "200 V", "0.0025 V"], a: 1,
    why: "ΔV = Ed = 200 · 0.5 = 100 V.",
  },
  {
    topic: "electrostatics", d: "advanced",
    q: "A uniformly charged non-conducting solid sphere of radius R has a field of magnitude E_s at its surface. What is the field magnitude at a distance R/2 from the centre?",
    c: ["E_s/4", "E_s/2", "E_s", "2E_s"], a: 1,
    why: "By Gauss's law the enclosed charge scales as r³ while the area scales as r², so E ∝ r inside the sphere: at R/2 the field is E_s/2.",
  },
  {
    topic: "magnetostatics", d: "basic",
    q: "A charged particle moves parallel to a uniform magnetic field. The magnetic force on it is…",
    c: ["maximum", "qvB", "qB/v", "zero"], a: 3,
    why: "F = qvB sin θ, and θ = 0 for motion along the field, so the force is zero.",
  },
  {
    topic: "magnetostatics", d: "intermediate",
    q: "A proton moves in a circle of radius r in a uniform magnetic field perpendicular to its velocity. If its speed doubles (same field), the radius becomes…",
    c: ["r/2", "r", "2r", "4r"], a: 2,
    why: "r = mv/(qB) is proportional to v, so doubling the speed doubles the radius.",
  },
  {
    topic: "magnetostatics", d: "advanced",
    q: "Two long parallel wires 0.1 m apart each carry 10 A in the same direction. What is the force per unit length between them? (μ₀ = 4π × 10⁻⁷ T·m/A)",
    c: [
      "2 × 10⁻⁴ N/m, repulsive",
      "2 × 10⁻⁵ N/m, attractive",
      "2 × 10⁻⁴ N/m, attractive",
      "4 × 10⁻⁴ N/m, repulsive",
    ],
    a: 2,
    why: "F/L = μ₀I₁I₂/(2πd) = 2 × 10⁻⁷ · 100 / 0.1 = 2 × 10⁻⁴ N/m, and parallel currents attract.",
  },
  {
    topic: "circuits", d: "basic",
    q: "Resistors of 2 Ω and 3 Ω are connected in series. What is the total resistance?",
    c: ["1.2 Ω", "6 Ω", "5 Ω", "0.83 Ω"], a: 2,
    why: "Series resistances add: 2 + 3 = 5 Ω.",
  },
  {
    topic: "circuits", d: "intermediate",
    q: "Resistors of 6 Ω and 3 Ω are connected in parallel. What is the total resistance?",
    c: ["9 Ω", "4.5 Ω", "1.5 Ω", "2 Ω"], a: 3,
    why: "R = (6 · 3)/(6 + 3) = 2 Ω.",
  },
  {
    topic: "circuits", d: "advanced",
    q: "A 100 µF capacitor, initially uncharged, charges through a 10 kΩ resistor from a source of voltage V₀. What is the capacitor voltage after 1 s?",
    c: ["0.37 V₀", "0.63 V₀", "0.86 V₀", "V₀"], a: 1,
    why: "RC = 10 000 Ω · 100 × 10⁻⁶ F = 1 s, so V = V₀(1 − e⁻¹) ≈ 0.63 V₀.",
  },
  {
    topic: "electrodynamics", d: "basic",
    q: "The magnetic flux through a loop changes by 0.2 Wb in 0.1 s. What is the average induced emf?",
    c: ["0.02 V", "2 V", "20 V", "0.5 V"], a: 1,
    why: "|ε| = ΔΦ/Δt = 0.2/0.1 = 2 V.",
  },
  {
    topic: "electrodynamics", d: "intermediate",
    q: "A straight rod of length 0.4 m moves at 5 m/s perpendicular to a uniform 0.5 T field and to its own length. What emf is induced between its ends?",
    c: ["0.1 V", "2.0 V", "1.0 V", "10 V"], a: 2,
    why: "ε = Bℓv = 0.5 · 0.4 · 5 = 1.0 V.",
  },
  {
    topic: "electrodynamics", d: "advanced",
    q: "A rod of length 0.4 m rotates at 50 rad/s about one end, in a plane perpendicular to a uniform 0.5 T field. What emf is induced between its ends?",
    c: ["0.5 V", "1.0 V", "2.0 V", "4.0 V"], a: 2,
    why: "ε = ½Bωℓ² = ½ · 0.5 · 50 · 0.16 = 2.0 V. (Using Bωℓ² would give 4.0 V; the factor ½ comes from averaging the speed along the rod.)",
  },
  // ---- Thermodynamics ---------------------------------------------------
  {
    topic: "heat-temperature", d: "basic",
    q: "How much heat is needed to raise the temperature of 0.5 kg of water by 20 °C? (c = 4200 J/(kg·°C))",
    c: ["2100 J", "4200 J", "42 000 J", "210 000 J"], a: 2,
    why: "Q = mcΔT = 0.5 · 4200 · 20 = 42 000 J.",
  },
  {
    topic: "heat-temperature", d: "intermediate",
    q: "200 g of water at 80 °C is mixed with 300 g of water at 20 °C in an insulated container. What is the final temperature?",
    c: ["40 °C", "50 °C", "56 °C", "44 °C"], a: 3,
    why: "(200 · 80 + 300 · 20)/500 = 44 °C, since both are water with the same specific heat.",
  },
  {
    topic: "heat-temperature", d: "advanced",
    q: "100 g of ice at 0 °C is dropped into 400 g of water at 50 °C in an insulated container (c_water = 4.2 J/(g·°C), L_fusion = 334 J/g). What is the final temperature?",
    c: ["≈ 20 °C", "≈ 24 °C", "≈ 30 °C", "≈ 40 °C"], a: 1,
    why: "Cooling the water to 0 °C releases 84 000 J, melting the ice takes 33 400 J, and the remaining 50 600 J warms 500 g by 50 600/(500 · 4.2) ≈ 24 °C. Ignoring the latent heat gives the wrong 40 °C.",
  },
  {
    topic: "entropy", d: "basic",
    q: "Which statement about the entropy of an isolated system is correct?",
    c: [
      "It always decreases in a spontaneous process",
      "It never decreases in a spontaneous process",
      "It is always constant",
      "It is zero at room temperature",
    ],
    a: 1,
    why: "The second law: the total entropy of an isolated system does not decrease in a spontaneous process.",
  },
  {
    topic: "entropy", d: "intermediate",
    q: "A system at a constant 300 K reversibly absorbs 600 J of heat. What is its entropy change?",
    c: ["0.5 J/K", "180 000 J/K", "300 J/K", "2 J/K"], a: 3,
    why: "ΔS = Q_rev/T = 600/300 = 2 J/K.",
  },
  {
    topic: "entropy", d: "advanced",
    q: "n moles of an ideal gas expand freely into a vacuum, doubling their volume (no heat exchanged, no work done). What is the entropy change of the gas?",
    c: ["0", "nR ln 2", "−nR ln 2", "nR/2"], a: 1,
    why: "Entropy is a state function: connect the same end states by a reversible isothermal expansion, giving ΔS = nR ln(V₂/V₁) = nR ln 2, even though Q = 0 in the free expansion.",
  },
  {
    topic: "laws-of-thermodynamics", d: "basic",
    q: "The zeroth law of thermodynamics is what justifies…",
    c: [
      "the conservation of energy",
      "the concept of temperature (thermal equilibrium is transitive)",
      "the increase of entropy",
      "the impossibility of reaching absolute zero",
    ],
    a: 1,
    why: "If A is in equilibrium with B and B with C, then A is with C — so equilibrium can be labelled by a single quantity, temperature.",
  },
  {
    topic: "laws-of-thermodynamics", d: "intermediate",
    q: "A gas absorbs 500 J of heat and does 200 J of work on its surroundings. What is the change in its internal energy?",
    c: ["200 J", "500 J", "700 J", "300 J"], a: 3,
    why: "First law: ΔU = Q − W = 500 − 200 = 300 J.",
  },
  {
    topic: "laws-of-thermodynamics", d: "advanced",
    q: "A monatomic ideal gas is heated at constant pressure. What fraction of the heat absorbed is converted into work done by the gas?",
    c: ["3/5", "2/5", "1", "2/3"], a: 1,
    why: "W = nRΔT and Q = nC_pΔT = (5/2)nRΔT, so W/Q = 2/5.",
  },
]);
