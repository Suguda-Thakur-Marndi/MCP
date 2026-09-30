"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "architectural" | "midnight";

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "architectural",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("architectural");

  useEffect(() => {
    const saved = localStorage.getItem("sentinel_theme") as ThemeMode | null;
    if (saved === "midnight" || saved === "architectural") {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
      if (saved === "midnight") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      document.documentElement.setAttribute("data-theme", "architectural");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem("sentinel_theme", t);
    document.documentElement.setAttribute("data-theme", t);
    if (t === "midnight") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "architectural" ? "midnight" : "architectural");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
