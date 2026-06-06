import { useState, useRef, useCallback, useEffect } from "react";
import type { VoiceVariant } from "@/lib/history";

interface ResultCardProps {
  originalText: string;
  translatedText: string;
  spokenText: string;
  variants: VoiceVariant[];
  failed?: string[];
  isRegenerating?: boolean;
  onSelect?: (voiceId: string) => void;
  onRegenerate?: (editedEnglish: string) => void;
  initialSelectedVoiceId?: string;
}

/* ── Icons ── */
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5V2z" /></svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="3" y="2" width="3" height="10" rx="0.5" /><rect x="8" y="2" width="3" height="10" rx="0.5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5v8M4 7.5l3 3 3-3" /><path d="M2.5 11.5h9" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" /><path d="M5.5 8.5l2 2 3.5-3.5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l3 3M1 10l7-7 3 3-7 7H1v-3z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 6.5h2l2-2v4L3 6.5H1z" /><path d="M12 6.5a5.5 5.5 0 10-2.3 4.5" />
    </svg>
  );
}

/* ── Single Voice Card ── */
function VoiceCard({
  variant,
  isPlaying,
  isSelected,
  onPlay,
  onSelect,
}: {
  variant: VoiceVariant;
  isPlaying: boolean;
  isSelected: boolean;
  onPlay: () => void;
  onSelect: () => void;
}) {
  return (
    <div className={`border rounded-sm p-3 transition-all duration-150 ${isSelected ? "border-ink-black bg-[#fafafa]" : "border-fog bg-snow"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] font-medium text-ink-black">{variant.voiceName}</span>
        {isSelected && (
          <span className="text-[12px] font-medium text-ink-black flex items-center gap-1"><CheckCircleIcon /> Selected</span>
        )}
      </div>
      <button
        onClick={onPlay}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-sm text-[13px] font-medium transition-colors duration-150 mb-2 ${isPlaying ? "bg-ink-black text-snow hover:opacity-90" : "bg-[#f3f3f3] text-ink-black hover:bg-[#ececec]"}`}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
        <span>{isPlaying ? "Playing" : "Play"}</span>
      </button>
      <button
        onClick={onSelect}
        className={`w-full py-[5px] rounded-sm text-[13px] font-medium transition-colors duration-150 ${isSelected ? "bg-ink-black text-snow" : "border border-fog text-smoke hover:border-ink-black hover:text-ink-black"}`}
      >
        {isSelected ? "Selected" : "Select"}
      </button>
    </div>
  );
}

/* ── Result Card ── */
export default function ResultCard({
  originalText,
  translatedText,
  spokenText,
  variants,
  failed,
  isRegenerating = false,
  onSelect,
  onRegenerate,
  initialSelectedVoiceId,
}: ResultCardProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedText, setEditedText] = useState(translatedText);
  const [copied, setCopied] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(initialSelectedVoiceId);
  const [playbackTime, setPlaybackTime] = useState(0);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rafRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync editedText when translatedText changes
  useEffect(() => {
    setEditedText(translatedText);
  }, [translatedText]);

  // Auto-resize textarea in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }
  }, [editedText, isEditMode]);

  /* ── Highlight Loop ── */
  const startHighlightLoop = useCallback((audio: HTMLAudioElement) => {
    const tick = () => {
      if (!audio.paused && !audio.ended) {
        setPlaybackTime(audio.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /* ── Copy ── */
  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(translatedText); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = translatedText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [translatedText]);

  /* ── Toggle Edit ── */
  const handleToggleEdit = useCallback(() => {
    setIsEditMode((prev) => !prev);
  }, []);

  /* ── Regenerate ── */
  const handleRegenerate = useCallback(() => {
    const trimmed = editedText.trim();
    if (!trimmed || isRegenerating) return;
    setIsEditMode(false);
    onRegenerate?.(trimmed);
  }, [editedText, isRegenerating, onRegenerate]);

  /* ── Play / Pause ── */
  const handlePlay = useCallback((variant: VoiceVariant) => {
    const existing = audioRefs.current.get(variant.id);
    if (existing && !existing.paused) {
      existing.pause();
      setCurrentPlayingId(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    audioRefs.current.forEach((audio, id) => {
      if (id !== variant.id && !audio.paused) audio.pause();
    });
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!existing) {
      const audio = new Audio(`data:audio/mpeg;base64,${variant.audioBase64}`);
      audio.addEventListener("ended", () => {
        setCurrentPlayingId(null);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      });
      audio.addEventListener("pause", () => {
        setCurrentPlayingId((curr) => curr === variant.id ? null : curr);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      });
      audioRefs.current.set(variant.id, audio);
      audio.play();
      startHighlightLoop(audio);
    } else {
      existing.play();
      startHighlightLoop(existing);
    }
    setCurrentPlayingId(variant.id);
  }, [startHighlightLoop]);

  /* ── Select ── */
  const handleSelect = useCallback((variant: VoiceVariant) => {
    setSelectedVoiceId(variant.id);
    onSelect?.(variant.id);
  }, [onSelect]);

  /* ── Download ── */
  const handleDownload = useCallback(() => {
    if (!selectedVoiceId) return;
    const variant = variants.find((v) => v.id === selectedVoiceId);
    if (!variant) return;
    const a = document.createElement("a");
    a.href = `data:audio/mpeg;base64,${variant.audioBase64}`;
    a.download = `wilson-${variant.voiceName}-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [selectedVoiceId, variants]);

  const selectedVariant = variants.find((v) => v.id === selectedVoiceId);
  const playingVariant = variants.find((v) => v.id === currentPlayingId);
  const highlightTimings = playingVariant?.sentenceTimings ?? variants[0]?.sentenceTimings ?? [];
  const isPlaying = !!currentPlayingId;

  // Find active sentence — highlightTimings is the single source of truth
  const activeIndex = isPlaying
    ? highlightTimings.findIndex((s) => playbackTime >= s.startTime && playbackTime <= s.endTime)
    : -1;

  return (
    <div className="border border-fog rounded-[10px] bg-snow overflow-hidden">
      {/* Original Chinese */}
      <div className="px-4 py-3 border-b border-fog">
        <div className="text-[12px] font-medium text-ash mb-1 uppercase tracking-wide">Original</div>
        <p className="text-[15px] font-normal leading-6 text-ink-black whitespace-pre-wrap">{originalText}</p>
      </div>

      {/* ── English: one box, display or edit ── */}
      <div className="px-4 py-3 border-b border-fog">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-medium text-ash uppercase tracking-wide">English</div>
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <button
                onClick={handleCopy}
                className="text-[12px] font-medium text-ash hover:text-ink-black transition-colors duration-150"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            <button
              onClick={handleToggleEdit}
              disabled={isRegenerating}
              className="flex items-center gap-[4px] px-2 py-[3px] rounded-sm text-[12px] font-medium text-smoke hover:text-ink-black hover:bg-[#ececec] transition-colors duration-150 disabled:opacity-30"
            >
              <EditIcon />
              <span>{isEditMode ? "Cancel" : "Edit"}</span>
            </button>
          </div>
        </div>

        {isEditMode ? (
          /* ── Edit Mode ── */
          <div>
            <textarea
              ref={textareaRef}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={3}
              className="w-full bg-[#fafafa] border border-fog rounded-sm px-3 py-2 text-[15px] font-normal leading-6 text-ink-black resize-none outline-none focus:border-ash transition-colors duration-150"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating || !editedText.trim()}
                className={`flex items-center gap-[6px] px-3 py-[6px] rounded-sm text-[13px] font-medium transition-all duration-150 ${editedText.trim() && !isRegenerating ? "bg-ink-black text-snow hover:opacity-90" : "bg-fog text-ash cursor-not-allowed"}`}
              >
                {isRegenerating ? (
                  <div className="w-3 h-3 border-2 border-snow/30 border-t-snow rounded-full animate-spin" />
                ) : (
                  <RefreshIcon />
                )}
                <span>{isRegenerating ? "..." : "Regenerate Voices"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── Display Mode: sentence highlighting from sentenceTimings (single source of truth) ── */
          <div className="text-[15px] font-normal leading-7 text-ink-black min-h-[24px]">
            {highlightTimings.length > 0 ? (
              highlightTimings.map((sentence, i) => (
                <span
                  key={i}
                  className={`
                    transition-colors duration-150 rounded-sm px-[3px] -mx-[3px]
                    ${activeIndex === i
                      ? "bg-amber-100 text-ink-black font-medium"
                      : "text-ink-black"
                    }
                  `}
                >
                  {sentence.text}{" "}
                </span>
              ))
            ) : (
              <span>{spokenText}</span>
            )}
          </div>
        )}
      </div>

      {/* Voice Comparison Section */}
      <div className="px-4 py-4 border-b border-fog">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] font-medium text-ash uppercase tracking-wide">Voice Options</div>
          {failed && failed.length > 0 && !isRegenerating && (
            <span className="text-[12px] text-amber-600">{failed.length} failed</span>
          )}
        </div>

        {isRegenerating && (
          <div className="flex items-center justify-center gap-3 py-10">
            <div className="w-4 h-4 border-2 border-fog border-t-ink-black rounded-full animate-spin" />
            <span className="text-[14px] font-normal text-smoke">Regenerating voice options...</span>
          </div>
        )}

        {!isRegenerating && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {variants.map((variant) => (
                <VoiceCard
                  key={variant.id}
                  variant={variant}
                  isPlaying={currentPlayingId === variant.id}
                  isSelected={selectedVoiceId === variant.id}
                  onPlay={() => handlePlay(variant)}
                  onSelect={() => handleSelect(variant)}
                />
              ))}
            </div>
            {failed && failed.length > 0 && (
              <p className="text-[12px] text-amber-600 mt-2">
                {variants.length >= 3
                  ? "Some voice options failed. Choose from the available ones."
                  : `Only ${variants.length} voice option(s) generated.`}
              </p>
            )}
          </>
        )}
      </div>

      {/* Download */}
      <div className="px-4 py-3 bg-[#fafafa] flex items-center justify-between">
        <div className="text-[13px] text-smoke">
          {selectedVariant
            ? <span>Selected: <span className="font-medium text-ink-black">{selectedVariant.voiceName}</span></span>
            : <span>Select a voice to download</span>}
        </div>
        <button
          onClick={handleDownload}
          disabled={!selectedVoiceId || isRegenerating}
          className={`flex items-center gap-[6px] px-4 py-[6px] rounded-sm text-[13px] font-medium transition-all duration-150 ${selectedVoiceId && !isRegenerating ? "bg-ink-black text-snow hover:opacity-90" : "bg-fog text-ash cursor-not-allowed"}`}
        >
          <DownloadIcon />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}
