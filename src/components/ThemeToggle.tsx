import { useEffect, useState } from "react";
import { mn } from "@/i18n/mn";

type ThemeChoice = "light" | "dark" | "system";
const STORAGE_KEY = "docconformance_theme";

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
    return stored ?? "system";
  });

  useEffect(() => {
    applyTheme(choice);
    localStorage.setItem(STORAGE_KEY, choice);
  }, [choice]);

  const options: { value: ThemeChoice; label: string }[] = [
    { value: "light", label: mn.theme.light },
    { value: "dark", label: mn.theme.dark },
    { value: "system", label: mn.theme.system },
  ];

  return (
    <div className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setChoice(opt.value)}
          className={`rounded-md px-2 py-1 font-medium transition-colors ${
            choice === opt.value
              ? "bg-accent text-accent-ink"
              : "text-ink-2 hover:bg-surface-2"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
