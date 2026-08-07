/**
 * CORE i18n system — Bangla/English bilingual support (§14.6).
 *
 * Provides a React context that holds the current locale and exposes a
 * `useTranslation()` hook returning a `t(key)` function. The locale
 * preference is persisted to localStorage and defaults to "en".
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { en, type TranslationKey } from "./locales/en";
import { bn } from "./locales/bn";

export type Locale = "en" | "bn";

const STORAGE_KEY = "core.locale";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  bn,
};

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "bn") return stored;
  } catch {
    // localStorage may be unavailable (private mode / SSR); fall through.
  }
  return "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures — preference stays in-memory for the session.
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((current) => {
      const next: Locale = current === "en" ? "bn" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey) => dictionaries[locale][key] ?? en[key] ?? key,
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}
