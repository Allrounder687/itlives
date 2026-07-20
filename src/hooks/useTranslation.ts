"use client";

import { useState, useEffect } from "react";
import { translations, getLanguage } from "@/utils/i18n";

export function useTranslation() {
  const [lang, setLang] = useState("English");

  useEffect(() => {
    // Set initial resolved language
    setLang(getLanguage());

    const handleLangChange = () => {
      setLang(getLanguage());
    };

    window.addEventListener("settings-language-changed", handleLangChange);
    return () => {
      window.removeEventListener("settings-language-changed", handleLangChange);
    };
  }, []);

  const t = (key: keyof typeof translations["English"]) => {
    const dict = (translations[lang as keyof typeof translations] || translations["English"]) as any;
    return dict[key] || translations["English"][key] || key;
  };

  return { t, currentLanguage: lang };
}
