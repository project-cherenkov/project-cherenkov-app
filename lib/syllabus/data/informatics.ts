import { section, topic } from "../define";
import type { SubjectSyllabus } from "../types";

// Source language: Indonesian (official). English names are unofficial glosses.
// Transcribed from the "Silabus — OSN" page maintained by IA TOKI (the
// national-level tab only; the OSN-K / OSN-P tabs weren't supplied, so no
// per-level flags are modelled here). The page marks changes against the 2025
// syllabus in red; that marking doesn't survive PDF text extraction, so it is
// NOT carried over.
export const informatics: SubjectSyllabus = {
  subject: "informatics",
  sourceLang: "id",
  source: { label: "Silabus OSN Bidang Informatika — IA TOKI", edition: "OSN 2026" },
  sections: [
    section("programming-basics", "Dasar-dasar Pemrograman", "Programming Fundamentals", [
      topic("language-syntax", "Sintaks dan semantik dasar dari bahasa yang diperbolehkan pada OSN yang bersangkutan", "Basic syntax and semantics of the language permitted in the relevant OSN"),
      topic("variables-types-expressions", "Variabel, tipe data, ekspresi, dan assignment", "Variables, data types, expressions, and assignment"),
      topic("basic-io", "Masukan dan keluaran dasar", "Basic input and output"),
      topic("branching-loops", "Percabangan dan perulangan", "Branching and loops"),
      topic("functions-parameters", "Fungsi dan parameter", "Functions and parameters"),
    ]),
    section("logic-bitwise", "Operasi Logika dan Bitwise", "Logic and Bitwise Operations", [
      topic("logical-operators", "Operator logika dasar (konjungsi, disjungsi, implikasi, biimplikasi, disjungsi eksklusif)", "Basic logical operators (conjunction, disjunction, implication, biconditional, exclusive or)"),
      topic("truth-tables", "Tabel kebenaran", "Truth tables"),
      topic("modus-ponens-tollens", "Modus Ponens dan modus Tollens", "Modus ponens and modus tollens"),
    ]),
    section("arithmetic", "Aritmetika", "Arithmetic", [
      topic("integers-operations", "Bilangan bulat, operasi (termasuk perpangkatan), perbandingan", "Integers, operations (including exponentiation), comparison"),
      topic("integer-properties", "Sifat-sifat bilangan bulat (tanda, paritas, keterbagian)", "Integer properties (sign, parity, divisibility)"),
      topic("modular-basics", "Operasi-operasi modular dasar (penjumlahan, pengurangan, perkalian)", "Basic modular operations (addition, subtraction, multiplication)"),
      topic("modular-exponentiation", "Perpangkatan modular", "Modular exponentiation"),
      topic("prime-numbers", "Bilangan prima", "Prime numbers"),
      topic("fractions-percentages", "Bilangan pecahan, persentase", "Fractions and percentages"),
      topic("number-theory", "Teori bilangan", "Number theory"),
      topic("set-theory", "Teori himpunan", "Set theory"),
    ]),
    section("counting", "Aturan Berhitung", "Counting Rules", [
      topic("sum-product-rules", "Aturan penjumlahan dan perkalian", "Sum and product rules"),
      topic("arithmetic-geometric-sequences", "Barisan aritmetika dan geometri", "Arithmetic and geometric sequences"),
      topic("fibonacci", "Bilangan Fibonacci", "Fibonacci numbers"),
      topic("permutations-combinations", "Permutasi dan kombinasi", "Permutations and combinations"),
      topic("probability", "Probabilitas", "Probability"),
      topic("pigeonhole-principle", "Pigeonhole principle", "Pigeonhole principle"),
      topic("inclusion-exclusion", "Prinsip inklusi dan eksklusi", "Inclusion–exclusion principle"),
      topic("pascal-binomial", "Segitiga Pascal, teorema binomial", "Pascal’s triangle, binomial theorem"),
    ]),
    section("recursion", "Rekursi", "Recursion", [
      topic("recursion-concept", "Konsep rekursi", "The concept of recursion"),
      topic("recursive-functions", "Fungsi matematis rekursi", "Recursive mathematical functions"),
      topic("simple-recursive-procedures", "Prosedur rekursi sederhana", "Simple recursive procedures"),
      topic("recursion-divide-and-conquer", "Divide-and-conquer", "Divide and conquer"),
      topic("backtracking", "Backtracking", "Backtracking"),
    ]),
    section("searching-sorting", "Pencarian dan Pengurutan", "Searching and Sorting", [
      topic("linear-search", "Linear search", "Linear search"),
      topic("binary-search", "Binary search", "Binary search"),
      topic("simple-sorts", "Bubble sort, insertion sort", "Bubble sort, insertion sort"),
      topic("advanced-sorts", "Quicksort, merge sort, heapsort", "Quicksort, merge sort, heapsort"),
    ]),
    section("problem-solving", "Strategi Pemecahan Masalah", "Problem-Solving Strategies", [
      topic("complete-search", "Complete search (brute-force dan strategi pruning)", "Complete search (brute force and pruning strategies)"),
      topic("greedy", "Greedy", "Greedy algorithms"),
      topic("strategy-divide-and-conquer", "Divide-and-conquer", "Divide and conquer"),
      topic("dynamic-programming", "Dynamic programming", "Dynamic programming"),
    ]),
    section("data-structures", "Struktur Data", "Data Structures", [
      topic("primitive-types", "Tipe data primitif (boolean, integer, character, floating point numbers)", "Primitive data types (boolean, integer, character, floating-point numbers)"),
      topic("arrays", "Array (termasuk multidimensi)", "Arrays (including multidimensional)"),
      topic("strings", "String dan operasinya", "Strings and their operations"),
      topic("stack-queue", "Stack dan queue", "Stacks and queues"),
      topic("binary-heap", "Binary heap", "Binary heap"),
      topic("disjoint-set", "Disjoint set", "Disjoint set"),
      topic("point-update-range-query", "Point Update, Range Query (misalnya menggunakan Fenwick tree atau Segment tree)", "Point update, range query (e.g. with a Fenwick tree or segment tree)"),
    ]),
    section("graphs-trees", "Graf dan Tree", "Graphs and Trees", [
      topic("basic-trees", "Tree dasar (termasuk rooted tree)", "Basic trees (including rooted trees)"),
      topic("directed-undirected-graphs", "Graf berarah dan graf tak berarah", "Directed and undirected graphs"),
      topic("weighted-graphs", "Graf berbobot dan graf tak berbobot", "Weighted and unweighted graphs"),
      topic("graph-representation", "Representasi graf (adjacency list, adjacency matrix, edge list)", "Graph representation (adjacency list, adjacency matrix, edge list)"),
      topic("graph-traversal", "Penjelajahan graf (BFS, DFS, keterhubungan)", "Graph traversal (BFS, DFS, connectivity)"),
      topic("shortest-path", "Shortest path (algoritma Dijkstra, algoritma Bellman-Ford, algoritma Floyd-Warshall)", "Shortest paths (Dijkstra, Bellman–Ford, Floyd–Warshall)"),
      topic("minimum-spanning-tree", "Minimum spanning tree (algoritma Prim, algoritma Kruskal)", "Minimum spanning trees (Prim, Kruskal)"),
      topic("lowest-common-ancestor", "Lowest common ancestor (LCA)", "Lowest common ancestor (LCA)"),
    ]),
    section("basic-geometry", "Geometri Dasar", "Basic Geometry", [
      topic("lines-angles", "Garis, segmen garis, sudut", "Lines, line segments, angles"),
      topic("basic-shapes", "Segitiga, persegi, persegi panjang, lingkaran", "Triangles, squares, rectangles, circles"),
      topic("cartesian-coordinates", "Titik, koordinat pada bidang Kartesius 2 dimensi", "Points and coordinates on the 2D Cartesian plane"),
      topic("euclidean-distance", "Jarak Euclidean", "Euclidean distance"),
      topic("pythagorean-theorem", "Teorema Pythagoras", "Pythagorean theorem"),
      topic("convex-hull-definition", "Definisi Convex hull", "Definition of the convex hull"),
    ]),
  ],
};
