import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { generations } from "@db/schema";
import { desc, eq } from "drizzle-orm";

/* ── Types (match frontend) ── */
interface SentenceTiming {
  sentenceIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  startChar: number;
  endChar: number;
}

interface VoiceVariant {
  id: string;
  voiceId: string;
  voiceName: string;
  audioBase64: string;
  mimeType: "audio/mpeg";
  sentenceTimings: SentenceTiming[];
}

/* ── Router ── */
export const generationRouter = createRouter({
  /** List all generations, newest first. Public — no auth. */
  list: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(generations)
      .orderBy(desc(generations.createdAt))
      .limit(100);

    return rows.map((row) => ({
      id: String(row.id),
      createdAt: row.createdAt?.getTime() ?? Date.now(),
      originalText: row.originalText,
      translatedText: row.translatedText,
      spokenText: row.spokenText,
      variants: parseVariants(row.variants),
      selectedVoiceId: row.selectedVoiceId ?? undefined,
    }));
  }),

  /** Get a single generation by ID. */
  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(generations)
        .where(eq(generations.id, Number(input.id)))
        .limit(1);

      if (rows.length === 0) return null;

      const row = rows[0];
      return {
        id: String(row.id),
        createdAt: row.createdAt?.getTime() ?? Date.now(),
        originalText: row.originalText,
        translatedText: row.translatedText,
        spokenText: row.spokenText,
        variants: parseVariants(row.variants),
        selectedVoiceId: row.selectedVoiceId ?? undefined,
      };
    }),

  /** Create a new generation. */
  create: publicQuery
    .input(
      z.object({
        originalText: z.string().min(1),
        translatedText: z.string().min(1),
        spokenText: z.string().min(1),
        variants: z.array(z.any()),
        selectedVoiceId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(generations).values({
        originalText: input.originalText,
        translatedText: input.translatedText,
        spokenText: input.spokenText,
        variants: JSON.stringify(input.variants),
        selectedVoiceId: input.selectedVoiceId,
      });

      const insertedId = result[0].insertId;
      return { id: String(insertedId) };
    }),

  /** Update selected voice. */
  updateSelected: publicQuery
    .input(
      z.object({
        id: z.string(),
        selectedVoiceId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(generations)
        .set({ selectedVoiceId: input.selectedVoiceId })
        .where(eq(generations.id, Number(input.id)));
      return { ok: true };
    }),

  /** Update translated text + variants + clear selection (for regenerate). */
  update: publicQuery
    .input(
      z.object({
        id: z.string(),
        translatedText: z.string().min(1),
        spokenText: z.string().min(1),
        variants: z.array(z.any()),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(generations)
        .set({
          translatedText: input.translatedText,
          spokenText: input.spokenText,
          variants: JSON.stringify(input.variants),
          selectedVoiceId: null,
        })
        .where(eq(generations.id, Number(input.id)));
      return { ok: true };
    }),
});

/* ── Helper: parse JSON variants safely ── */
function parseVariants(raw: string | null): VoiceVariant[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as VoiceVariant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
