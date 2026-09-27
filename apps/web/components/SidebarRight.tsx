"use client";

import dynamic from "next/dynamic";
import { GripVerticalIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/utils";

const Chat = dynamic(
  () => import("@/components/assistant-chat/chat").then((mod) => mod.Chat),
  { ssr: false },
);

export function SidebarRight({
  name,
  className,
  width,
  onWidthChange,
}: {
  name: string;
  className?: string;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const { isOpen, close } = useSidebarPanel(name);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    resizeStart.current = {
      x: event.clientX,
      width: Math.min(width, maxChatWidth()),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!resizeStart.current) return;
    onWidthChange(
      clampChatWidth(
        resizeStart.current.width + resizeStart.current.x - event.clientX,
      ),
    );
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    resizeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let nextWidth: number;
    if (event.key === "ArrowLeft") nextWidth = width + 32;
    else if (event.key === "ArrowRight") nextWidth = width - 32;
    else if (event.key === "Home") nextWidth = 360;
    else if (event.key === "End") nextWidth = maxChatWidth();
    else return;

    event.preventDefault();
    onWidthChange(clampChatWidth(nextWidth));
  }

  return (
    <div
      style={{ "--chat-sidebar-width": `${width}px` } as CSSProperties}
      className={cn(
        "fixed right-0 top-0 z-50 h-screen border-l bg-background transition-transform duration-200 ease-linear",
        "w-full lg:w-[min(var(--chat-sidebar-width),90vw)]",
        isOpen ? "translate-x-0" : "translate-x-full",
        className,
      )}
    >
      {isOpen && (
        <div
          role="separator"
          aria-label="Redimensionner le chat"
          aria-orientation="vertical"
          aria-valuemin={360}
          aria-valuemax={1200}
          aria-valuenow={width}
          tabIndex={0}
          className="group absolute inset-y-0 left-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onKeyDown={handleResizeKeyDown}
        >
          <GripVerticalIcon className="size-4 rounded bg-background text-muted-foreground shadow-sm group-hover:text-foreground" />
        </div>
      )}
      <div className="flex h-full w-full flex-col overflow-hidden">
        {isOpen ? <Chat open onClose={close} /> : null}
      </div>
    </div>
  );
}

function maxChatWidth() {
  return Math.min(1200, Math.floor(window.innerWidth * 0.9));
}

function clampChatWidth(width: number) {
  return Math.min(maxChatWidth(), Math.max(360, width));
}

function useSidebarPanel(name: string) {
  const { state, openMobile, isMobile, setOpen, setOpenMobile } = useSidebar();
  const isOpen = isMobile ? openMobile.includes(name) : state.includes(name);
  const close = useCallback(() => {
    const removeSidebar = (openSidebars: string[]) =>
      openSidebars.filter((sidebarName) => sidebarName !== name);

    setOpen(removeSidebar);
    setOpenMobile(removeSidebar);
  }, [name, setOpen, setOpenMobile]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, isOpen]);

  return { close, isOpen };
}
