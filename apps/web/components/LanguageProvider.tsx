"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type React from "react";
import frTranslations from "@/locales/fr.json";
import { translateUiText } from "@/utils/i18n/translate-ui-text";

export type InterfaceLanguage = "fr" | "en";

const STORAGE_KEY = "inbox-zero:interface-language";
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];
const IGNORED_CONTENT =
  '[data-i18n-ignore], [translate="no"], [contenteditable], [role="textbox"], pre, code, script, style, noscript, svg';

const LanguageContext = createContext<{
  language: InterfaceLanguage;
  setLanguage: (language: InterfaceLanguage) => void;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<InterfaceLanguage>("fr");

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "en") setLanguageState("en");
    } catch {
      // The default language still works when browser storage is unavailable.
    }
  }, []);

  const setLanguage = useCallback((nextLanguage: InterfaceLanguage) => {
    setLanguageState(nextLanguage);
    try {
      localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // Keep the current page usable when browser storage is unavailable.
    }
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      <TranslatePage language={language} />
      {children}
    </LanguageContext.Provider>
  );
}

export function useInterfaceLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("LanguageProvider is missing");
  return context;
}

type OriginalValue = { original: string; translated: string };

function TranslatePage({ language }: { language: InterfaceLanguage }) {
  const textValues = useRef(new WeakMap<Text, OriginalValue>());
  const attributeValues = useRef(
    new WeakMap<Element, Map<string, OriginalValue>>(),
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let frame: number | null = null;
    const translatePage = () => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      let node = walker.nextNode();
      while (node) {
        const textNode = node as Text;
        const current = textNode.nodeValue ?? "";
        const saved = textValues.current.get(textNode);
        const original =
          saved && current === saved.translated ? saved.original : current;
        const ignored = Boolean(
          textNode.parentElement?.closest(IGNORED_CONTENT),
        );
        const translated =
          language === "fr" && !ignored
            ? translateUiText(original, frTranslations)
            : original;

        if (current !== translated) textNode.nodeValue = translated;
        if (translated !== original) {
          textValues.current.set(textNode, { original, translated });
        } else {
          textValues.current.delete(textNode);
        }

        node = walker.nextNode();
      }

      for (const element of document.body.querySelectorAll(
        TRANSLATABLE_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(","),
      )) {
        let savedAttributes = attributeValues.current.get(element);
        for (const attribute of TRANSLATABLE_ATTRIBUTES) {
          const current = element.getAttribute(attribute);
          if (current === null) continue;

          const saved = savedAttributes?.get(attribute);
          const original =
            saved && current === saved.translated ? saved.original : current;
          const ignored = Boolean(element.closest(IGNORED_CONTENT));
          const translated =
            language === "fr" && !ignored
              ? translateUiText(original, frTranslations)
              : original;

          if (current !== translated)
            element.setAttribute(attribute, translated);
          if (translated !== original) {
            savedAttributes ??= new Map();
            savedAttributes.set(attribute, { original, translated });
            attributeValues.current.set(element, savedAttributes);
          } else {
            savedAttributes?.delete(attribute);
          }
        }
      }
    };

    const scheduleTranslation = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        translatePage();
      });
    };

    translatePage();
    const observer = new MutationObserver(scheduleTranslation);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [language]);

  return null;
}
