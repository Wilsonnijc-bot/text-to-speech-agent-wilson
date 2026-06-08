import { useState, useCallback } from "react";
import Sidebar from "@/features/text-to-speech/components/Sidebar";
import MainStage from "@/features/text-to-speech/components/MainStage";
import type { HistoryItem } from "@/features/text-to-speech/types/history";
import { trpc } from "@/providers/trpc";

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null);

  // Shared history is loaded by Sidebar via tRPC.generation.list
  // We use this query here only to trigger refetches
  const utils = trpc.useUtils();

  const handleGenerated = useCallback(() => {
    // Refetch the history list so sidebar shows the new item
    utils.generation.list.invalidate();
  }, [utils]);

  const handleNewChat = useCallback(() => {
    setActiveItem(null);
    // Signal MainStage to reset to home page
    window.dispatchEvent(new Event("wilson:newChat"));
  }, []);

  const handleSelectItem = useCallback((item: HistoryItem) => {
    setActiveItem(item);
  }, []);

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-snow">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        activeItemId={activeItem?.id ?? null}
        onSelectItem={handleSelectItem}
        onNewChat={handleNewChat}
      />
      <div className="w-px bg-fog flex-shrink-0" />
      <MainStage
        activeItem={activeItem}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
