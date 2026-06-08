/* ── Types only — no localStorage.
 * All history is now stored in MySQL via tRPC.
 * Everyone who uses the app shares the same public history.
 */

export interface SentenceTiming {
  sentenceIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  startChar: number;
  endChar: number;
}

export interface VoiceVariant {
  id: string;
  voiceId: string;
  voiceName: string;
  audioBase64: string;
  mimeType: "audio/mpeg";
  sentenceTimings: SentenceTiming[];
}

export interface HistoryItem {
  id: string;
  createdAt: number;
  originalText: string;
  translatedText: string;
  spokenText: string;
  variants: VoiceVariant[];
  selectedVoiceId?: string;
}

/* ── LocalStorage helpers (legacy migration) ──
 * These are kept for reference but no longer used.
 * All data now lives in MySQL.
 */
export function loadLegacyHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem("wilson_history");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        typeof item.spokenText === "string" &&
        Array.isArray(item.variants)
    );
  } catch {
    return [];
  }
}

export function clearLegacyHistory(): void {
  localStorage.removeItem("wilson_history");
}
