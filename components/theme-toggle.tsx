"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PixelIcon } from "@/components/pixel-icon";

const STORAGE_KEY = "rt:theme";

function readTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota errors
    }
  }

  const dim = size === "sm" ? 16 : 18;
  const padding = size === "sm" ? "px-2 py-1.5" : "px-2.5 py-1.5";

  return (
    <motion.button
      onClick={toggle}
      aria-label={theme === "dark" ? "switch to day" : "switch to night"}
      whileTap={{ scale: 0.92 }}
      className={`rounded-lg border-2 border-ink bg-paper text-ink hover:bg-peach-soft/40 transition shrink-0 ${padding}`}
      style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
      title={
        mounted
          ? theme === "dark"
            ? "switch to day"
            : "switch to night"
          : "theme"
      }
    >
      <PixelIcon
        name={mounted && theme === "dark" ? "sun" : "moon"}
        size={dim}
      />
    </motion.button>
  );
}

/**
 * Inline script string — embed in <head> via dangerouslySetInnerHTML to
 * apply the stored theme *before* React mounts, so we don't flash light.
 */
export const themeInitScript = `
(function () {
  try {
    var k = ${JSON.stringify(STORAGE_KEY)};
    var s = localStorage.getItem(k);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (s === 'dark' || (!s && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;
