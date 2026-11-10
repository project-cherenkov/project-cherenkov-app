import { defineSyllabus, inSources, section, topic } from "../define";
import type { SubjectSyllabus } from "../types";

// Source language: Indonesian (official). English names are unofficial glosses.
// Transcribed from the "Silabus — OSN" page maintained by IA TOKI, which says it
// follows the IOI syllabus "with various adjustments" and links the Ministry's
// OSN 2026 guide. Re-checked topic by topic against the page on 2026-10-24:
// all 10 sections and 51 topics match. The page marks changes against the 2025
// syllabus in red; that marking is NOT carried over.
//
// No per-level (OSN-K / OSN-P) flags are modelled, on purpose. The OSN-P page
// says its material "refers to the OSN syllabus" (i.e. all of it), and the
// OSN-K page gives only a non-exhaustive list of themes ("terdiri atas, namun
// tidak terbatas pada": Boolean algebra, set theory, graphs, geometry,
// combinatorics, mathematical models, arithmetic series, simulation,
// optimisation, logical induction/deduction, computational thinking, I/O,
// reading algorithms, branching, loops, arrays, subprograms, recursion).
// Neither is a topic-by-topic table, so mapping them onto topic ids would be
// guesswork. Revisit if IA TOKI or the Ministry publishes per-topic marks.
//
// Second source: the IOI syllabus (English, official), compared on 2026-11-10
// against the version used for IOI 2025. A topic lists "ioi" in `in` only when
// the IOI text names it, with the IOI's own code in `refs` (PF = programming
// fundamentals, DS = discrete structures, AL = algorithms, §5.1 = arithmetic
// and geometry). Where the OSN list's topic is broader or differently worded
// than anything the IOI names (number theory, discrete probability, bubble and
// insertion sort, weighted graphs, modular exponentiation) it is left as
// OSN-only rather than stretched. The IOI's six categories (included, outside
// focus, excluded, …) are NOT modelled yet; `in` means "the IOI syllabus
// lists it as included".
export const informatics: SubjectSyllabus = defineSyllabus({
  subject: "informatics",
  sources: [
    {
      id: "osn",
      kind: "national",
      short: "OSN",
      label: "Silabus OSN Bidang Informatika",
      issuer: "IA TOKI (Ikatan Alumni TOKI)",
      edition: "OSN 2026",
      url: "https://osn.toki.id/silabus",
      language: "id",
      accessed: "2026-10-24",
      verification: "compared",
      note: {
        id: "Halaman IA TOKI menyebut silabus ini mengikuti silabus IOI dengan berbagai penyesuaian, dan menautkan Panduan OSN dari Kementerian.",
        en: "The IA TOKI page says this syllabus follows the IOI syllabus with various adjustments, and links the Ministry’s OSN guide.",
      },
    },
    {
      id: "ioi",
      kind: "international",
      short: "IOI",
      label: "The International Olympiad in Informatics Syllabus",
      issuer: "International Olympiad in Informatics (International Scientific Committee)",
      edition: "Version used for IOI 2025",
      url: "https://ioinformatics.org/files/ioi-syllabus-2025.pdf",
      language: "en",
      accessed: "2026-11-10",
      verification: "compared",
      note: {
        id: "Teks menyebutnya versi resmi untuk IOI 2025, meski catatan kaki PDF masih bertuliskan “DRAFT”. Belum ditemukan versi untuk IOI 2026.",
        en: "The text calls this the official version for IOI 2025, although the PDF’s footer still says “DRAFT”. No version for IOI 2026 has been found.",
      },
    },
  ],
  sections: [
    section("programming-basics", "Dasar-dasar Pemrograman", "Programming Fundamentals", [
      inSources(topic("language-syntax", "Sintaks dan semantik dasar dari bahasa yang diperbolehkan pada OSN yang bersangkutan", "Basic syntax and semantics of the language permitted in the relevant OSN"), ["osn", "ioi"], { ioi: "PF1" }),
      inSources(topic("variables-types-expressions", "Variabel, tipe data, ekspresi, dan assignment", "Variables, data types, expressions, and assignment"), ["osn", "ioi"], { ioi: "PF1" }),
      inSources(topic("basic-io", "Masukan dan keluaran dasar", "Basic input and output"), ["osn", "ioi"], { ioi: "PF1" }),
      inSources(topic("branching-loops", "Percabangan dan perulangan", "Branching and loops"), ["osn", "ioi"], { ioi: "PF1" }),
      inSources(topic("functions-parameters", "Fungsi dan parameter", "Functions and parameters"), ["osn", "ioi"], { ioi: "PF1" }),
    ]),
    section("logic-bitwise", "Operasi Logika dan Bitwise", "Logic and Bitwise Operations", [
      inSources(topic("logical-operators", "Operator logika dasar (konjungsi, disjungsi, implikasi, biimplikasi, disjungsi eksklusif)", "Basic logical operators (conjunction, disjunction, implication, biconditional, exclusive or)"), ["osn", "ioi"], { ioi: "DS2" }),
      inSources(topic("truth-tables", "Tabel kebenaran", "Truth tables"), ["osn", "ioi"], { ioi: "DS2" }),
      inSources(topic("modus-ponens-tollens", "Modus Ponens dan modus Tollens", "Modus ponens and modus tollens"), ["osn", "ioi"], { ioi: "DS2" }),
    ]),
    section("arithmetic", "Aritmetika", "Arithmetic", [
      inSources(topic("integers-operations", "Bilangan bulat, operasi (termasuk perpangkatan), perbandingan", "Integers, operations (including exponentiation), comparison"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("integer-properties", "Sifat-sifat bilangan bulat (tanda, paritas, keterbagian)", "Integer properties (sign, parity, divisibility)"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("modular-basics", "Operasi-operasi modular dasar (penjumlahan, pengurangan, perkalian)", "Basic modular operations (addition, subtraction, multiplication)"), ["osn", "ioi"], { ioi: "§5.1" }),
      topic("modular-exponentiation", "Perpangkatan modular", "Modular exponentiation"),
      inSources(topic("prime-numbers", "Bilangan prima", "Prime numbers"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("fractions-percentages", "Bilangan pecahan, persentase", "Fractions and percentages"), ["osn", "ioi"], { ioi: "§5.1" }),
      topic("number-theory", "Teori bilangan", "Number theory"),
      inSources(topic("set-theory", "Teori himpunan", "Set theory"), ["osn", "ioi"], { ioi: "DS1" }),
    ]),
    section("counting", "Aturan Berhitung", "Counting Rules", [
      inSources(topic("sum-product-rules", "Aturan penjumlahan dan perkalian", "Sum and product rules"), ["osn", "ioi"], { ioi: "DS4" }),
      inSources(topic("arithmetic-geometric-sequences", "Barisan aritmetika dan geometri", "Arithmetic and geometric sequences"), ["osn", "ioi"], { ioi: "DS4" }),
      inSources(topic("fibonacci", "Bilangan Fibonacci", "Fibonacci numbers"), ["osn", "ioi"], { ioi: "DS4" }),
      inSources(topic("permutations-combinations", "Permutasi dan kombinasi", "Permutations and combinations"), ["osn", "ioi"], { ioi: "DS4" }),
      topic("probability", "Probabilitas", "Probability"),
      inSources(topic("pigeonhole-principle", "Pigeonhole principle", "Pigeonhole principle"), ["osn", "ioi"], { ioi: "DS4" }),
      inSources(topic("inclusion-exclusion", "Prinsip inklusi dan eksklusi", "Inclusion–exclusion principle"), ["osn", "ioi"], { ioi: "DS4" }),
      inSources(topic("pascal-binomial", "Segitiga Pascal, teorema binomial", "Pascal’s triangle, binomial theorem"), ["osn", "ioi"], { ioi: "DS4" }),
    ]),
    section("recursion", "Rekursi", "Recursion", [
      inSources(topic("recursion-concept", "Konsep rekursi", "The concept of recursion"), ["osn", "ioi"], { ioi: "PF4" }),
      inSources(topic("recursive-functions", "Fungsi matematis rekursi", "Recursive mathematical functions"), ["osn", "ioi"], { ioi: "PF4" }),
      inSources(topic("simple-recursive-procedures", "Prosedur rekursi sederhana", "Simple recursive procedures"), ["osn", "ioi"], { ioi: "PF4" }),
      inSources(topic("recursion-divide-and-conquer", "Divide-and-conquer", "Divide and conquer"), ["osn", "ioi"], { ioi: "PF4" }),
      inSources(topic("backtracking", "Backtracking", "Backtracking"), ["osn", "ioi"], { ioi: "PF4" }),
    ]),
    section("searching-sorting", "Pencarian dan Pengurutan", "Searching and Sorting", [
      inSources(topic("linear-search", "Linear search", "Linear search"), ["osn", "ioi"], { ioi: "AL3a" }),
      inSources(topic("binary-search", "Binary search", "Binary search"), ["osn", "ioi"], { ioi: "AL3a" }),
      topic("simple-sorts", "Bubble sort, insertion sort", "Bubble sort, insertion sort"),
      inSources(topic("advanced-sorts", "Quicksort, merge sort, heapsort", "Quicksort, merge sort, heapsort"), ["osn", "ioi"], { ioi: "AL3a" }),
    ]),
    section("problem-solving", "Strategi Pemecahan Masalah", "Problem-Solving Strategies", [
      inSources(topic("complete-search", "Complete search (brute-force dan strategi pruning)", "Complete search (brute force and pruning strategies)"), ["osn", "ioi"], { ioi: "AL2" }),
      inSources(topic("greedy", "Greedy", "Greedy algorithms"), ["osn", "ioi"], { ioi: "AL2" }),
      inSources(topic("strategy-divide-and-conquer", "Divide-and-conquer", "Divide and conquer"), ["osn", "ioi"], { ioi: "AL2" }),
      inSources(topic("dynamic-programming", "Dynamic programming", "Dynamic programming"), ["osn", "ioi"], { ioi: "AL2" }),
    ]),
    section("data-structures", "Struktur Data", "Data Structures", [
      inSources(topic("primitive-types", "Tipe data primitif (boolean, integer, character, floating point numbers)", "Primitive data types (boolean, integer, character, floating-point numbers)"), ["osn", "ioi"], { ioi: "PF3" }),
      inSources(topic("arrays", "Array (termasuk multidimensi)", "Arrays (including multidimensional)"), ["osn", "ioi"], { ioi: "PF3" }),
      inSources(topic("strings", "String dan operasinya", "Strings and their operations"), ["osn", "ioi"], { ioi: "PF3" }),
      inSources(topic("stack-queue", "Stack dan queue", "Stacks and queues"), ["osn", "ioi"], { ioi: "AL3b" }),
      inSources(topic("binary-heap", "Binary heap", "Binary heap"), ["osn", "ioi"], { ioi: "AL3b" }),
      inSources(topic("disjoint-set", "Disjoint set", "Disjoint set"), ["osn", "ioi"], { ioi: "AL3b" }),
      inSources(topic("point-update-range-query", "Point Update, Range Query (misalnya menggunakan Fenwick tree atau Segment tree)", "Point update, range query (e.g. with a Fenwick tree or segment tree)"), ["osn", "ioi"], { ioi: "AL3b" }),
    ]),
    section("graphs-trees", "Graf dan Tree", "Graphs and Trees", [
      inSources(topic("basic-trees", "Tree dasar (termasuk rooted tree)", "Basic trees (including rooted trees)"), ["osn", "ioi"], { ioi: "DS5" }),
      inSources(topic("directed-undirected-graphs", "Graf berarah dan graf tak berarah", "Directed and undirected graphs"), ["osn", "ioi"], { ioi: "DS5" }),
      topic("weighted-graphs", "Graf berbobot dan graf tak berbobot", "Weighted and unweighted graphs"),
      inSources(topic("graph-representation", "Representasi graf (adjacency list, adjacency matrix, edge list)", "Graph representation (adjacency list, adjacency matrix, edge list)"), ["osn", "ioi"], { ioi: "AL3b" }),
      inSources(topic("graph-traversal", "Penjelajahan graf (BFS, DFS, keterhubungan)", "Graph traversal (BFS, DFS, connectivity)"), ["osn", "ioi"], { ioi: "AL3a" }),
      inSources(topic("shortest-path", "Shortest path (algoritma Dijkstra, algoritma Bellman-Ford, algoritma Floyd-Warshall)", "Shortest paths (Dijkstra, Bellman–Ford, Floyd–Warshall)"), ["osn", "ioi"], { ioi: "AL3a" }),
      inSources(topic("minimum-spanning-tree", "Minimum spanning tree (algoritma Prim, algoritma Kruskal)", "Minimum spanning trees (Prim, Kruskal)"), ["osn", "ioi"], { ioi: "AL3a" }),
      inSources(topic("lowest-common-ancestor", "Lowest common ancestor (LCA)", "Lowest common ancestor (LCA)"), ["osn", "ioi"], { ioi: "AL3b" }),
    ]),
    section("basic-geometry", "Geometri Dasar", "Basic Geometry", [
      inSources(topic("lines-angles", "Garis, segmen garis, sudut", "Lines, line segments, angles"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("basic-shapes", "Segitiga, persegi, persegi panjang, lingkaran", "Triangles, squares, rectangles, circles"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("cartesian-coordinates", "Titik, koordinat pada bidang Kartesius 2 dimensi", "Points and coordinates on the 2D Cartesian plane"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("euclidean-distance", "Jarak Euclidean", "Euclidean distance"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("pythagorean-theorem", "Teorema Pythagoras", "Pythagorean theorem"), ["osn", "ioi"], { ioi: "§5.1" }),
      inSources(topic("convex-hull-definition", "Definisi Convex hull", "Definition of the convex hull"), ["osn", "ioi"], { ioi: "AL10" }),
    ]),
  ],
});
