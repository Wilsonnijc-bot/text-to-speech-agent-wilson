import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/mysql-core";

/* ── Generations ──
 * Shared public history. No login, no identifier.
 * Everyone who uses the app shares the same history.
 */
export const generations = mysqlTable("generations", {
  id: serial("id").primaryKey(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text").notNull(),
  spokenText: text("spoken_text").notNull(),
  // JSON: [{ id, voiceId, voiceName, audioBase64, mimeType, sentenceTimings: [...] }]
  variants: text("variants").notNull(),
  // Which voice was selected for download
  selectedVoiceId: varchar("selected_voice_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
