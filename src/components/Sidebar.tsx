import { trpc } from "@/providers/trpc";
import type { HistoryItem } from "@/lib/history";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeItemId: string | null;
  onSelectItem: (item: HistoryItem) => void;
  onNewChat: () => void;
}

// SVG Icons
const Icons = {
  newChat: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v12M2 8h12" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3 3" />
    </svg>
  ),
  expand: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5h12M2 8h12M2 11h12" />
    </svg>
  ),
  chatBubble: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.5a5.5 5.5 0 10-1.1 3.3L12 11.5V6.5z" />
    </svg>
  ),
};

function SidebarNavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-3 py-[6px] rounded-sm text-left
        text-[14px] font-normal leading-5 text-ink-black
        transition-colors duration-150
        ${active ? "bg-[#ececec]" : "hover:bg-[#ececec]"}
      `}
    >
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-ink-black">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SidebarSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-3 mt-5 mb-1 text-[12px] font-medium text-ink-black tracking-normal">
      {children}
    </h3>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  activeItemId,
  onSelectItem,
  onNewChat,
}: SidebarProps) {
  // Load shared history from MySQL via tRPC
  const historyQuery = trpc.generation.list.useQuery();
  const history = historyQuery.data ?? [];

  const handleSelectItem = (item: HistoryItem) => {
    onSelectItem(item);
  };

  if (collapsed) {
    return (
      <aside
        className="h-full bg-paper flex flex-col items-center py-3 px-2 flex-shrink-0"
        style={{ width: "48px" }}
      >
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-[#ececec] transition-colors mb-4"
        >
          {Icons.expand}
        </button>
        <button
          onClick={onNewChat}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-[#ececec] transition-colors mb-2"
        >
          {Icons.newChat}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="h-full bg-paper flex flex-col flex-shrink-0 overflow-hidden"
      style={{ width: "260px" }}
    >
      {/* Top: Toggle button */}
      <div className="flex items-center px-3 pt-3 pb-1">
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-[#ececec] transition-colors"
        >
          {Icons.expand}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-none">
        {/* Main Navigation */}
        <nav className="flex flex-col gap-[2px]">
          <SidebarNavItem
            icon={Icons.newChat}
            label="New chat"
            onClick={onNewChat}
          />
          <SidebarNavItem
            icon={Icons.search}
            label="Search chats"
          />
        </nav>

        {/* Shared Recent Section — from MySQL */}
        <SidebarSectionTitle>
          Recent
          {historyQuery.isLoading && (
            <span className="ml-2 text-ash font-normal">Loading...</span>
          )}
        </SidebarSectionTitle>

        {history.length === 0 && !historyQuery.isLoading && (
          <p className="px-3 text-[12px] text-ash leading-5">
            No history yet. Generate your first audio!
          </p>
        )}

        <nav className="flex flex-col gap-[2px]">
          {history.map((item) => {
            const title = item.originalText.slice(0, 28);
            return (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className={`
                  w-full flex items-center gap-2 px-3 py-[6px] rounded-sm text-left
                  text-[14px] font-normal leading-5 text-ink-black
                  transition-colors duration-150
                  ${activeItemId === item.id ? "bg-[#ececec]" : "hover:bg-[#ececec]"}
                `}
              >
                <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-ink-black">
                  {Icons.chatBubble}
                </span>
                <span className="flex-1 truncate">
                  {title}{item.originalText.length > 28 ? "..." : ""}
                </span>
                {item.variants.length > 0 && (
                  <span className="flex-shrink-0 text-[11px] text-ash ml-1">{item.variants.length}v</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
