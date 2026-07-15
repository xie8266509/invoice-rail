"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Theme } from "@radix-ui/themes";
import { THEME_STORAGE_KEY } from "@/lib/constants";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeShell({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setModeState(stored);
      }
      setSystemDark(media.matches);
    }, 0);
    media.addEventListener("change", sync);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", sync);
    };
  }, []);

  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      setMode: (nextMode) => {
        setModeState(nextMode);
        window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      },
    }),
    [mode, resolved],
  );

  return (
    <ThemeContext.Provider value={value}>
      <Theme
        appearance={resolved}
        accentColor="jade"
        grayColor="slate"
        radius="large"
        scaling="100%"
      >
        <div className="app-root" data-theme={resolved}>
          {children}
        </div>
      </Theme>
    </ThemeContext.Provider>
  );
}

export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeMode must be used inside ThemeShell.");
  return context;
}
