/**
 * LanguageToggle — switch between English and Bangla (§14.6).
 *
 * A small button that toggles the active locale via the i18n context.
 * The preference is persisted to localStorage by the provider.
 */

import { useTranslation } from "../i18n";

export function LanguageToggle() {
  const { locale, toggleLocale } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={`Switch language. Current: ${locale === "en" ? "English" : "বাংলা"}`}
      title={locale === "en" ? "Switch to বাংলা" : "Switch to English"}
      className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {locale === "en" ? "বাংলা" : "EN"}
    </button>
  );
}
