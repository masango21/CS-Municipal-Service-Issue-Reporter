"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLanguage,
  supportedLanguages,
  translations,
  type SupportedLanguageCode,
} from "@/data/translations";

const STORAGE_KEY = "municipal-service-language";

type LanguageContextValue = {
  locale: SupportedLanguageCode;
  setLocale: (nextLocale: SupportedLanguageCode) => void;
  t: (key: string) => string;
  languages: typeof supportedLanguages;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function isSupportedLanguage(value: string | null): value is SupportedLanguageCode {
  return value !== null && value in translations;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLanguageCode>(() => {
    if (typeof window === "undefined") {
      return defaultLanguage;
    }

    const storedLocale = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(storedLocale) ? storedLocale : defaultLanguage;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: SupportedLanguageCode) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: string) => {
      const phrase = translations[locale][key] ?? translations[defaultLanguage][key] ?? key;
      return phrase;
    },
    [locale],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t, languages: supportedLanguages }),
    [locale, setLocale, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
