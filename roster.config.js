/**
 * roster.config.js — Single Source of Truth for Faculty, Students, and Subjects.
 * Used by scripts/register-class.js, Demo Switcher (Navbar.jsx), and UI components.
 */

// Set to true to show "Student A, Student B..." instead of sample student names
export const ANONYMIZE_NAMES = true;

// ── 1. Faculty Roster (Hardhat Accounts #1 – #4) ──────────────────────────────
export const FACULTY_ROSTER = [
  {
    accountIndex: 1,
    name: "Dr. Alice Morgan",
    dept: "Computer Science",
    subjectCode: "CS-401",
  },
  {
    accountIndex: 2,
    name: "Dr. Bruce Wayne",
    dept: "Cyber Security",
    subjectCode: "CY-302",
  },
  {
    accountIndex: 3,
    name: "Prof. Clara Oswald",
    dept: "Artificial Intelligence",
    subjectCode: "AI-201",
  },
  {
    accountIndex: 4,
    name: "Prof. David Miller",
    dept: "Information Technology",
    subjectCode: "IT-104",
  },
];

// ── 2. Student Roster (Hardhat Accounts #5 – #14) ─────────────────────────────
export const STUDENT_ROSTER = [
  {
    accountIndex: 5,
    enrollmentNo: "ENR-2024-001",
    name: "Alex Smith",
    dept: "Computer Science",
    anonymizedName: "Student A",
  },
  {
    accountIndex: 6,
    enrollmentNo: "ENR-2024-002",
    name: "Bethany Jones",
    dept: "Cyber Security",
    anonymizedName: "Student B",
  },
  {
    accountIndex: 7,
    enrollmentNo: "ENR-2024-003",
    name: "Charlie Davis",
    dept: "Cyber Security",
    anonymizedName: "Student C",
  },
  {
    accountIndex: 8,
    enrollmentNo: "ENR-2024-004",
    name: "Daniel Wilson",
    dept: "Artificial Intelligence",
    anonymizedName: "Student D",
  },
  {
    accountIndex: 9,
    enrollmentNo: "ENR-2024-005",
    name: "Emma Watson",
    dept: "Artificial Intelligence",
    anonymizedName: "Student E",
  },
  {
    accountIndex: 10,
    enrollmentNo: "ENR-2024-006",
    name: "Felix Brown",
    dept: "Information Technology",
    anonymizedName: "Student F",
  },
  {
    accountIndex: 11,
    enrollmentNo: "ENR-2024-007",
    name: "Grace Hopper",
    dept: "Information Technology",
    anonymizedName: "Student G",
  },
  {
    accountIndex: 12,
    enrollmentNo: "ENR-2024-008",
    name: "Henry Ford",
    dept: "Computer Science",
    anonymizedName: "Student H",
  },
  {
    accountIndex: 13,
    enrollmentNo: "ENR-2024-009",
    name: "Isabella Garcia",
    dept: "Cyber Security",
    anonymizedName: "Student I",
  },
  {
    accountIndex: 14,
    enrollmentNo: "ENR-2024-010",
    name: "Jack Miller",
    dept: "Artificial Intelligence",
    anonymizedName: "Student J",
  },
];

// ── 3. Subjects Roster ────────────────────────────────────────────────────────
export const SUBJECTS_ROSTER = [
  {
    id: 1,
    name: "Cryptography & Network Security",
    code: "CS-401",
    facultyAccountIndex: 1,
  },
  {
    id: 2,
    name: "Blockchain & Smart Contracts",
    code: "CY-302",
    facultyAccountIndex: 2,
  },
  {
    id: 3,
    name: "Machine Learning & AI",
    code: "AI-201",
    facultyAccountIndex: 3,
  },
  {
    id: 4,
    name: "Cloud & Web Technologies",
    code: "IT-104",
    facultyAccountIndex: 4,
  },
];

/**
 * Returns formatted student display name according to ANONYMIZE_NAMES flag.
 */
export function getStudentDisplayName(st) {
  if (ANONYMIZE_NAMES) {
    return st.anonymizedName || `Student (${st.enrollmentNo})`;
  }
  return st.name;
}
