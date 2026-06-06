import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/providers/trpc";
import ResultCard from "./ResultCard";
import type { HistoryItem } from "@/lib/history";

interface MainStageProps {
  activeItem: HistoryItem | null;
  onGenerated: () => void;
}

/* ── Icons ── */
function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v7M6 3v5a2 2 0 104 0V3" /><path d="M4 7v1a4 4 0 008 0V7" /><path d="M8 12v3M6 15h4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8l12-6-6 12-2-6-4-6z" />
    </svg>
  );
}

/* ── Header ── */
function BrandHeader() {
  return (
    <header className="flex items-center px-8 py-3 flex-shrink-0">
      <div className="text-[18px] font-semibold leading-7 text-ink-black tracking-[-0.27px] select-none">Wilson</div>
    </header>
  );
}

/* ── ChatGPT-style Loading Dots ── */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <div className="w-1.5 h-1.5 rounded-full bg-smoke animate-[bounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: "0ms" }} />
      <div className="w-1.5 h-1.5 rounded-full bg-smoke animate-[bounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: "200ms" }} />
      <div className="w-1.5 h-1.5 rounded-full bg-smoke animate-[bounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: "400ms" }} />
    </div>
  );
}

/* ── Main Component ── */
export default function MainStage({ activeItem, onGenerated }: MainStageProps) {
  const [result, setResult] = useState<{
    dbId?: string;
    originalText: string;
    translatedText: string;
    spokenText: string;
    variants: HistoryItem["variants"];
    failed?: string[];
  } | null>(null);
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isFirstView, setIsFirstView] = useState(!activeItem);

  // tRPC mutations for DB persistence
  const createGeneration = trpc.generation.create.useMutation({
    onSuccess: () => onGenerated(),
  });
  const updateGeneration = trpc.generation.update.useMutation({
    onSuccess: () => onGenerated(),
  });

  // Full generation (translate + TTS)
  const generateMutation = trpc.generate.generate.useMutation({
    onMutate: () => {
      setError(null);
      setSelectedVoiceId(undefined);
      setIsFirstView(false);
    },
    onSuccess: (data) => {
      // Save to MySQL
      createGeneration.mutate({
        originalText: data.originalText,
        translatedText: data.translatedText,
        spokenText: data.spokenText,
        variants: data.variants as any,
        selectedVoiceId: undefined,
      }, {
        onSuccess: (dbResult) => {
          setResult({
            dbId: dbResult.id,
            originalText: data.originalText,
            translatedText: data.translatedText,
            spokenText: data.spokenText,
            variants: data.variants as any,
            failed: data.failed,
          });
          setSubmittedText(null);
        },
      });
    },
    onError: (err) => {
      setError(err.message || "Connection failed. Please try again.");
      setSubmittedText(null);
    },
  });

  // Voice-only regeneration
  const regenerateMutation = trpc.generate.regenerateVoices.useMutation({
    onMutate: () => {
      setError(null);
      setSelectedVoiceId(undefined);
    },
    onSuccess: (data) => {
      setResult((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          spokenText: data.spokenText,
          variants: data.variants as any,
          failed: data.failed,
        };
        // Update DB if we have a dbId
        if (prev.dbId) {
          updateGeneration.mutate({
            id: prev.dbId,
            translatedText: prev.translatedText,
            spokenText: data.spokenText,
            variants: data.variants as any,
          });
        }
        return updated;
      });
    },
    onError: (err) => {
      setError(err.message || "Voice regeneration failed. Please try again.");
    },
  });

  const isLoading = generateMutation.isPending;
  const isRegenerating = regenerateMutation.isPending;

  const handleGenerate = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      setError(null);
      setSelectedVoiceId(undefined);
      setSubmittedText(text.trim());
      setIsFirstView(false);
      generateMutation.mutate({ text });
    },
    [generateMutation, isLoading]
  );

  const handleRegenerate = useCallback(
    (editedEnglish: string) => {
      if (!editedEnglish.trim() || isRegenerating) return;
      setError(null);
      setSelectedVoiceId(undefined);
      setResult((prev) => prev ? { ...prev, translatedText: editedEnglish } : prev);
      regenerateMutation.mutate({ englishText: editedEnglish });
    },
    [regenerateMutation, isRegenerating]
  );

  // When activeItem changes (sidebar click → loads from MySQL)
  useEffect(() => {
    if (activeItem) {
      setResult({
        dbId: activeItem.id,
        originalText: activeItem.originalText,
        translatedText: activeItem.translatedText,
        spokenText: activeItem.spokenText,
        variants: activeItem.variants,
      });
      setSelectedVoiceId(activeItem.selectedVoiceId);
      setSubmittedText(null);
      setIsFirstView(false);
      setError(null);
    }
  }, [activeItem]);

  // "New chat" handler
  useEffect(() => {
    const handleNewChat = () => {
      setIsFirstView(true);
      setResult(null);
      setError(null);
      setSelectedVoiceId(undefined);
      setSubmittedText(null);
    };
    window.addEventListener("wilson:newChat", handleNewChat);
    return () => window.removeEventListener("wilson:newChat", handleNewChat);
  }, []);

  return (
    <main className="flex-1 h-full flex flex-col bg-snow overflow-hidden">
      <BrandHeader />

      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="w-full max-w-[768px] mx-auto px-4 py-6">

          {/* Hero title */}
          {isFirstView && (
            <div className="text-center mb-6">
              <h1 className="text-[44px] font-semibold leading-[52px] text-ink-black tracking-[-1px] mb-1 select-none">Wilson</h1>
              <p className="text-[16px] font-normal leading-6 text-smoke select-none">Your best text-to-speech agent.</p>
            </div>
          )}

          {/* Back link */}
          {!isFirstView && !activeItem && !isLoading && (
            <div className="mb-4">
              <button
                onClick={() => { setIsFirstView(true); setResult(null); setError(null); setSelectedVoiceId(undefined); setSubmittedText(null); }}
                className="text-[13px] font-medium text-ash hover:text-ink-black transition-colors duration-150"
              >
                &larr; New generation
              </button>
            </div>
          )}

          {/* Submitted Chinese stays visible during loading */}
          {submittedText && (
            <div className="flex justify-end mb-4">
              <div className="bg-[#f3f3f3] rounded-[10px] px-4 py-3 max-w-[85%]">
                <p className="text-[15px] font-normal leading-6 text-ink-black whitespace-pre-wrap">{submittedText}</p>
              </div>
            </div>
          )}

          {/* ChatGPT-style loading dots */}
          {isLoading && (
            <div className="flex items-start gap-3 mb-4">
              <div className="w-7 h-7 rounded-full bg-ink-black flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-semibold text-snow">W</span>
              </div>
              <div className="bg-[#f9f9f9] rounded-[10px] px-4 py-3">
                <ThinkingDots />
              </div>
            </div>
          )}

          {/* Input — only on home page */}
          {isFirstView && <ChatInput onSubmit={handleGenerate} isLoading={isLoading} />}

          {/* Error */}
          {error && !isLoading && !isRegenerating && (
            <div className="mt-4 px-4 py-3 border border-red-200 bg-red-50 rounded-sm text-[14px] font-normal text-red-700">
              {error}
            </div>
          )}

          {/* Result */}
          {!isLoading && result && (
            <div className="mt-6">
              <ResultCard
                originalText={result.originalText}
                translatedText={result.translatedText}
                spokenText={result.spokenText}
                variants={result.variants}
                failed={result.failed}
                isRegenerating={isRegenerating}
                onSelect={(voiceId) => setSelectedVoiceId(voiceId)}
                onRegenerate={handleRegenerate}
                initialSelectedVoiceId={selectedVoiceId}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ── Chat Input ── */
function ChatInput({ onSubmit, isLoading }: { onSubmit: (text: string) => void; isLoading: boolean }) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }
  }, [text]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setText("");
    const el = textareaRef.current;
    if (el) el.style.height = "auto";
  }, [text, isLoading, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }, [handleSubmit]);

  return (
    <div className="relative flex items-end gap-2 bg-snow border border-fog rounded-[10px] px-4 py-3 transition-colors duration-150 focus-within:border-ash">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={"\u8f93\u5165\u4e2d\u6587\u53e3\u64ad\u6587\u6848\uff0c\u751f\u6210\u82f1\u6587\u8bed\u97f3..."}
        rows={1}
        className="flex-1 bg-transparent text-[16px] font-normal leading-6 text-ink-black placeholder:text-ash resize-none outline-none py-[4px] min-h-[24px] max-h-[200px] font-ui-sans"
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <button className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-[#ececec] transition-colors duration-150 text-ink-black" aria-label="Voice input">
          <MicIcon />
        </button>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isLoading}
          className={`flex items-center gap-1.5 px-3 h-8 rounded-sm text-[14px] font-medium transition-all duration-150 flex-shrink-0 ${text.trim() && !isLoading ? "bg-ink-black text-snow hover:opacity-90" : "bg-[#ececec] text-ash cursor-not-allowed"}`}
        >
          {isLoading ? <div className="w-3 h-3 border-2 border-snow/30 border-t-snow rounded-full animate-spin" /> : <SendIcon />}
          <span>{isLoading ? "..." : "Generate"}</span>
        </button>
      </div>
    </div>
  );
}
