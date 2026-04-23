"use client";

import { useMemo } from "react";

type Locale = "en" | "de";

const dictionary = {
  en: {
    moduleTitle: "Lessons Learned Cockpit",
    moduleSubtitle:
      "Capture, review, action, and report lessons in a single workflow workspace.",
    capture: "Capture",
    review: "Review",
    actions: "Actions",
    reports: "Reports",
    quality: "Quality",
    searchPlaceholder: "Search lessons, problem statements, or outcomes",
    filters: "Filters",
    all: "All",
    noResults: "No lessons match the current filters.",
    details: "Details",
    comments: "Comments",
    addComment: "Add comment",
    submit: "Submit",
    cancel: "Cancel",
    approve: "Approve",
    reject: "Reject",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  },
  de: {
    moduleTitle: "Lessons-Learned-Cockpit",
    moduleSubtitle:
      "Erfassen, prüfen, umsetzen und berichten in einem gemeinsamen Workflow-Bereich.",
    capture: "Erfassung",
    review: "Prüfung",
    actions: "Aktionen",
    reports: "Berichte",
    quality: "Qualität",
    searchPlaceholder: "Lessons, Probleme oder Ergebnisse suchen",
    filters: "Filter",
    all: "Alle",
    noResults: "Keine Lessons entsprechen den aktuellen Filtern.",
    details: "Details",
    comments: "Kommentare",
    addComment: "Kommentar hinzufügen",
    submit: "Speichern",
    cancel: "Abbrechen",
    approve: "Freigeben",
    reject: "Ablehnen",
    pending: "Ausstehend",
    approved: "Freigegeben",
    rejected: "Abgelehnt",
  },
} as const;

export type LessonsI18nKey = keyof (typeof dictionary)["en"];

export function useLessonsI18n() {
  const locale = useMemo<Locale>(() => {
    if (typeof window === "undefined") return "en";
    return window.navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
  }, []);

  return (key: LessonsI18nKey) => dictionary[locale][key] ?? dictionary.en[key];
}
