"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "control-room" | "dark" | "architectural" | "midnight";

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "control-room",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("control-room");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "control-room");
    document.documentElement.classList.add("dark");
  }, []);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.classList.add("dark");
  };

  const toggleTheme = () => {
    // Keep high-contrast tactical dark mode active
    setTheme("control-room");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
