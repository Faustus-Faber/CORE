/**
 * Bangla (বাংলা) translations (§14.6 bilingual support).
 *
 * Mirrors the keys in `en.ts`. Keep both files in sync when adding keys.
 */

import type { TranslationKey } from "./en";

export const bn: Record<TranslationKey, string> = {
  // ── Navigation ──────────────────────────────────────────────────────────
  "nav.dashboard": "ড্যাশবোর্ড",
  "nav.reports": "রিপোর্ট",
  "nav.map": "মানচিত্র",
  "nav.evidence": "প্রমাণ",
  "nav.volunteers": "স্বেচ্ছাসেবক",
  "nav.copilot": "কোপাইলট",
  "nav.settings": "সেটিংস",

  // ── Common actions ──────────────────────────────────────────────────────
  "action.submit": "জমা দিন",
  "action.cancel": "বাতিল",
  "action.search": "অনুসন্ধান",
  "action.filter": "ফিল্টার",
  "action.loading": "লোড হচ্ছে",
  "action.error": "ত্রুটি",

  // ── Report form labels ──────────────────────────────────────────────────
  "form.title": "শিরোনাম",
  "form.description": "বিবরণ",
  "form.location": "অবস্থান",
  "form.severity": "তীব্রতা",
  "form.incidentType": "ঘটনার ধরন",

  // ── Status labels ───────────────────────────────────────────────────────
  "status.published": "প্রকাশিত",
  "status.underReview": "পর্যালোচনাধীন",
  "status.rejected": "প্রত্যাখ্যাত",
  "status.clarificationRequested": "স্পষ্টীকরণ অনুরোধ করা হয়েছে",
};
