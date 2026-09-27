"use client";

import { Select } from "@/components/Select";
import { useInterfaceLanguage } from "@/components/LanguageProvider";

export function LanguageSection() {
  const { language, setLanguage } = useInterfaceLanguage();

  return (
    <div className="max-w-sm" data-i18n-ignore>
      <Select
        name="interface-language"
        label={
          language === "fr" ? "Langue de l’interface" : "Interface language"
        }
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value === "en" ? "en" : "fr")
        }
        options={[
          { label: "Français", value: "fr" },
          { label: "English", value: "en" },
        ]}
      />
    </div>
  );
}
