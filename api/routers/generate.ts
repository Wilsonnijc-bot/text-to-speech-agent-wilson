import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { env } from "../lib/env";

/* ── Voice Settings (updated) ── */
const EXCITED_VOICE_SETTINGS = {
  stability: 0.42,
  similarity_boost: 0.80,
  style: 0.22,
  use_speaker_boost: true,
  speed: 1.04,
};

/* ── Valid pause values ── */
const VALID_PAUSE_VALUES = [0.18, 0.25, 0.40, 0.45, 0.55];
const DEFAULT_PAUSE = 0.40;

/* ── Types ── */
interface Segment {
  text: string;
  pauseAfter: number;
}

interface PacingResult {
  displayText: string;
  segments: Segment[];
}

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

interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
  normalized_alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

/* ── LLM: Translate + Segment with pauses ── */
async function translateAndSegment(chineseText: string): Promise<PacingResult> {
  const systemPrompt = `You are a professional short-form video script translator and voice pacing director. Your job:

1. Translate the user's Chinese \u53e3\u64ad\u6587\u6848 into natural, energetic English short-video narration.
2. Split the English into spoken segments optimized for voice delivery.
3. Assign pauseAfter values between segments.

Rules:
- Tone: energetic, clear, slightly excited, but not cringe. TikTok/short-video style.
- Do not add facts not in the original. Do not cut content.
- Each segment should usually be 4-18 words.
- Use only these pauseAfter values: 0.18, 0.25, 0.40, 0.45, 0.55.
  - 0.18 = tiny phrase pause
  - 0.25 = phrase transition / colon / dash pause
  - 0.40 = normal sentence pause
  - 0.45 = hook question pause
  - 0.55 = final CTA / impact pause
- Do NOT output <break> tags in segment text.
- Return ONLY valid JSON. No markdown, no explanations.

Output format:
{
  "displayText": "Clean English text shown to user. No break tags.",
  "segments": [
    { "text": "One spoken segment.", "pauseAfter": 0.40 },
    { "text": "Another segment.", "pauseAfter": 0.45 }
  ]
}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.openrouterApiKey}`,
      "HTTP-Referer": "https://wilson.app",
      "X-Title": "Wilson TTS",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: chineseText },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Pacing LLM failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    choices?: [{ message?: { content?: string } }];
  };

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Pacing LLM returned empty response");

  const parsed = JSON.parse(raw) as PacingResult;
  return validatePacingResult(parsed);
}

/* ── LLM: Segment only (for regenerate) ── */
async function segmentOnly(englishText: string): Promise<PacingResult> {
  const systemPrompt = `You are a voice pacing director for short-form video narration.

Split the given English text into spoken segments optimized for voice delivery.
Assign pauseAfter values between segments.

Rules:
- Each segment should usually be 4-18 words.
- Use only these pauseAfter values: 0.18, 0.25, 0.40, 0.45, 0.55.
  - 0.18 = tiny phrase pause
  - 0.25 = phrase transition / colon / dash pause  
  - 0.40 = normal sentence pause
  - 0.45 = hook question pause
  - 0.55 = final CTA / impact pause
- Do NOT output <break> tags in segment text.
- Return ONLY valid JSON. No markdown, no explanations.

Output format:
{
  "displayText": "Clean English text shown to user. No break tags.",
  "segments": [
    { "text": "One spoken segment.", "pauseAfter": 0.40 },
    { "text": "Another segment.", "pauseAfter": 0.45 }
  ]
}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.openrouterApiKey}`,
      "HTTP-Referer": "https://wilson.app",
      "X-Title": "Wilson TTS",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: englishText },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`Segment LLM failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    choices?: [{ message?: { content?: string } }];
  };

  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Segment LLM returned empty response");

  const parsed = JSON.parse(raw) as PacingResult;
  return validatePacingResult(parsed);
}

/* ── Validate + clamp pacing result ── */
function validatePacingResult(result: PacingResult): PacingResult {
  const cleanSegments = (result.segments || []).map((seg) => {
    let pause = typeof seg.pauseAfter === "number" ? seg.pauseAfter : DEFAULT_PAUSE;
    // Clamp to nearest valid value
    if (!VALID_PAUSE_VALUES.includes(pause)) {
      pause = VALID_PAUSE_VALUES.reduce((closest, v) =>
        Math.abs(v - pause) < Math.abs(closest - pause) ? v : closest
      , DEFAULT_PAUSE);
    }
    // Remove any accidental break tags from segment text
    const cleanText = (seg.text || "")
      .replace(/<break\s+time="[^"]*"\s*\/?>/gi, "")
      .replace(/<break\s*\/?>/gi, "")
      .trim();
    return { text: cleanText, pauseAfter: pause };
  }).filter((seg) => seg.text.length > 0);

  // Rebuild displayText from clean segments
  const displayText = cleanSegments.map((s) => s.text).join(" ");

  return { displayText, segments: cleanSegments };
}

/* ── Fallback: deterministic punctuation-based segmentation ── */
function fallbackSegment(text: string): PacingResult {
  const segments: Segment[] = [];
  // Split by sentence boundaries, keeping delimiters
  const parts = text.match(/[^.!?:;\u2014\u2013]+[.!?:;\u2014\u2013]+|[^.!?:;\u2014\u2013]+$/g) || [text];

  parts.forEach((part, i) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const isLast = i === parts.length - 1;

    let pause = DEFAULT_PAUSE;
    if (isLast) {
      pause = 0.55; // final CTA / impact
    } else if (/\?\s*$/.test(trimmed) && i === 0) {
      pause = 0.45; // opening hook question
    } else if (/[.!?]\s*$/.test(trimmed)) {
      pause = 0.40; // normal sentence
    } else if (/[:;\u2014\u2013]\s*$/.test(trimmed)) {
      pause = 0.25; // phrase transition
    }

    // Further split long segments on commas
    const subParts = trimmed.split(/,\s+/);
    subParts.forEach((sub, j) => {
      const subTrimmed = sub.trim();
      if (!subTrimmed) return;
      const isLastSub = j === subParts.length - 1;
      const subPause = isLastSub ? pause : (subTrimmed.length > 30 ? 0.18 : pause);
      segments.push({ text: subTrimmed, pauseAfter: subPause });
    });
  });

  return { displayText: text, segments };
}

/* ── Build ttsText with <break> tags ── */
function buildTtsText(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      const isLast = i === segments.length - 1;
      if (isLast) return seg.text;
      return `${seg.text} <break time="${seg.pauseAfter}s" />`;
    })
    .join(" ");
}

/* ── Clean text for alignment matching ── */
function cleanForAlignment(text: string): string {
  let t = text.trim();
  t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{2934}-\u{2935}\u{25AA}-\u{25AB}\u{25FB}-\u{25FE}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{FE0F}\u{200D}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2795}-\u{2797}\u{27B0}]/gu, "");
  t = t.replace(/\s+/g, " ");
  t = t.replace(/[~*#^|<>{}[\]\\]/g, "");
  return t.trim();
}

/* ── Sentence Splitting ── */
interface SentenceSpan {
  sentenceIndex: number;
  text: string;
  startChar: number;
  endChar: number;
}

function splitIntoSentenceSpans(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentenceText = match[0].trim();
    const startChar = match.index;
    const endChar = match.index + match[0].length;
    spans.push({ sentenceIndex: index, text: sentenceText, startChar, endChar });
    index++;
  }

  if (spans.length === 0 && text.trim()) {
    spans.push({ sentenceIndex: 0, text: text.trim(), startChar: 0, endChar: text.length });
  }

  return spans;
}

/* ── Build Sentence Timings from Alignment ── */
function buildSentenceTimings(
  text: string,
  response: ElevenLabsTimestampResponse
): SentenceTiming[] {
  const alignment = response.alignment || response.normalized_alignment;
  if (!alignment) return [];

  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  if (!characters || !character_start_times_seconds || !character_end_times_seconds) {
    return [];
  }

  const spans = splitIntoSentenceSpans(text);

  return spans.map((span) => {
    let firstCharIdx = span.startChar;
    while (firstCharIdx < characters.length && characters[firstCharIdx] === " ") {
      firstCharIdx++;
    }

    let lastCharIdx = Math.min(span.endChar - 1, characters.length - 1);
    while (lastCharIdx > 0 && characters[lastCharIdx] === " ") {
      lastCharIdx--;
    }

    const startTime = character_start_times_seconds[firstCharIdx] ?? 0;
    const endTime = character_end_times_seconds[lastCharIdx] ?? startTime;

    return {
      sentenceIndex: span.sentenceIndex,
      text: span.text,
      startChar: span.startChar,
      endChar: span.endChar,
      startTime,
      endTime,
    };
  });
}

/* ── Get Voices ── */
async function getSelectedVoices(): Promise<{ id: string; name: string }[]> {
  if (env.elevenlabsVoiceList.length > 0) {
    return env.elevenlabsVoiceList;
  }
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": env.elevenlabsApiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Failed to fetch voice list");
  const data = (await res.json()) as { voices?: Array<{ voice_id: string; name: string; category?: string }> };
  const voices = (data.voices || []).filter((v) => v.category !== "professional").slice(0, 5);
  if (voices.length === 0) throw new Error("No voices available");
  return voices.map((v) => ({ id: v.voice_id, name: v.name }));
}

/* ── Generate Single Voice WITH TIMESTAMPS ── */
async function generateSpeechWithVoice(
  ttsText: string,
  alignmentText: string,
  voice: { id: string; name: string }
): Promise<VoiceVariant> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/with-timestamps?output_format=${env.elevenlabsOutputFormat}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.elevenlabsApiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        text: ttsText,
        model_id: env.elevenlabsModelId,
        language_code: "en",
        voice_settings: EXCITED_VOICE_SETTINGS,
        apply_text_normalization: "auto",
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Voice ${voice.name} failed (HTTP ${response.status}): ${errorText.slice(0, 100)}`);
  }

  const data = (await response.json()) as ElevenLabsTimestampResponse;
  const sentenceTimings = buildSentenceTimings(alignmentText, data);

  return {
    id: `variant-${voice.id}`,
    voiceId: voice.id,
    voiceName: voice.name,
    audioBase64: data.audio_base64,
    mimeType: "audio/mpeg",
    sentenceTimings,
  };
}

/* ── Parallel Multi-Voice Generation ── */
async function generateVoiceVariants(
  ttsText: string,
  alignmentText: string
): Promise<{ variants: VoiceVariant[]; failed: string[] }> {
  const voices = await getSelectedVoices();
  console.log(`[Wilson] Generating ${voices.length} voice variants...`);

  const results = await Promise.allSettled(
    voices.map((voice) => generateSpeechWithVoice(ttsText, alignmentText, voice))
  );

  const variants: VoiceVariant[] = [];
  const failed: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      variants.push(result.value);
    } else {
      console.error(`[Wilson] Voice ${voices[i].name} failed:`, result.reason);
      failed.push(voices[i].name);
    }
  });

  console.log(`[Wilson] ${variants.length}/${voices.length} voices succeeded`);
  return { variants, failed };
}

/* ── Router ── */
export const generateRouter = createRouter({
  generate: publicQuery
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { text } = input;
      console.log("[Wilson] Received:", text.slice(0, 50));

      // Step 1: Translate + segment with pauses (LLM)
      let pacing: PacingResult;
      try {
        console.log("[Wilson] Translating and segmenting with DeepSeek...");
        pacing = await translateAndSegment(text);
        console.log("[Wilson] Segments:", pacing.segments.length);
      } catch (err) {
        console.error("[Wilson] LLM pacing failed, using fallback:", err);
        // Fallback: simple translation then deterministic segmentation
        const fallbackTranslated = await fallbackTranslate(text);
        pacing = fallbackSegment(fallbackTranslated);
      }

      // Step 2: Build ttsText with <break> tags
      const ttsText = buildTtsText(pacing.segments);
      const alignmentText = cleanForAlignment(pacing.displayText);
      console.log("[Wilson] TTS text length:", ttsText.length);

      // Step 3: Generate multi-voice variants
      const { variants, failed } = await generateVoiceVariants(ttsText, alignmentText);

      if (variants.length === 0) {
        throw new Error("All voice generations failed. Please try again.");
      }

      return {
        originalText: text,
        translatedText: pacing.displayText,
        spokenText: alignmentText,
        variants,
        failed,
      };
    }),

  regenerateVoices: publicQuery
    .input(z.object({ englishText: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { englishText } = input;
      console.log("[Wilson] Regenerating voices for:", englishText.slice(0, 50));

      // Step 1: Segment only (no translation)
      let pacing: PacingResult;
      try {
        console.log("[Wilson] Segmenting with DeepSeek...");
        pacing = await segmentOnly(englishText);
      } catch (err) {
        console.error("[Wilson] LLM segment failed, using fallback:", err);
        pacing = fallbackSegment(englishText);
      }

      // Step 2: Build ttsText
      const ttsText = buildTtsText(pacing.segments);
      const alignmentText = cleanForAlignment(pacing.displayText);

      // Step 3: Generate voices
      const { variants, failed } = await generateVoiceVariants(ttsText, alignmentText);

      if (variants.length === 0) {
        throw new Error("All voice generations failed. Please try again.");
      }

      return {
        spokenText: alignmentText,
        variants,
        failed,
      };
    }),
});

/* ── Fallback translation (simple, no pacing) ── */
async function fallbackTranslate(chineseText: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.openrouterApiKey}`,
      "HTTP-Referer": "https://wilson.app",
      "X-Title": "Wilson TTS",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages: [
        {
          role: "system",
          content: "Translate the following Chinese text into natural English for short-form video narration. Output ONLY the English text.",
        },
        { role: "user", content: chineseText },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Fallback translation failed (HTTP ${res.status})`);

  const data = (await res.json()) as { choices?: [{ message?: { content?: string } }] };
  const translated = data.choices?.[0]?.message?.content;
  if (!translated) throw new Error("Fallback translation empty");
  return translated.trim();
}
