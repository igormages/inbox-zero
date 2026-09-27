"use client";

import { Suspense, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { SideNav } from "@/components/SideNav";
import { SidebarRight } from "@/components/SidebarRight";
import { cn } from "@/utils";

const CrispWithNoSSR = dynamic(() => import("@/components/CrispChat"));

function ContentWrapper({
  children,
  chatWidth,
}: {
  children: React.ReactNode;
  chatWidth: number;
}) {
  const { state } = useSidebar();
  const pathname = usePathname();
  const isAssistantRoute = pathname?.includes("/assistant");
  const isMailRoute = pathname?.includes("/mail");
  const isRightSidebarOpen =
    !isAssistantRoute && state.includes("chat-sidebar");

  // The padding only exists to clear the fixed MobileHeader, which neither of
  // these routes renders — on mail it showed up as a blank strip above the
  // screen's own sidebar and toolbar.
  const noTopPadding = isAssistantRoute || isMailRoute;

  return (
    <div
      style={{ "--chat-sidebar-width": `${chatWidth}px` } as CSSProperties}
      className={cn(
        "min-w-0 flex-1 transition-all duration-200 ease-linear",
        isRightSidebarOpen && "lg:mr-[min(var(--chat-sidebar-width),90vw)]",
      )}
    >
      <SidebarInset
        className={cn(
          "overflow-hidden bg-background pt-9 max-w-full",
          noTopPadding && "pt-0",
          // The mail page fills the viewport and scrolls its thread list
          // internally, so layout banners shrink it instead of overflowing
          isMailRoute && "h-svh",
        )}
      >
        {children}
      </SidebarInset>
      <Suspense>
        <CrispWithNoSSR />
      </Suspense>
    </div>
  );
}

export function SideNavWithTopNav({
  children,
  defaultOpen,
  feedbackEnabled,
}: {
  children: React.ReactNode;
  defaultOpen: boolean;
  feedbackEnabled: boolean;
}) {
  const pathname = usePathname();
  const [storedChatWidth, setChatWidth] = useLocalStorage<number>(
    "chat-sidebar-width",
    450,
    { initializeWithValue: false },
  );
  const chatWidth = Number.isFinite(storedChatWidth)
    ? Math.min(1200, Math.max(360, storedChatWidth))
    : 450;

  if (!pathname) return null;

  const isAssistantRoute = pathname.includes("/assistant");
  // The mail screen ships its own sidebar, so this one would be a second copy.
  const isMailRoute = pathname.includes("/mail");

  // Ugly code. May change the onboarding path later so we don't need to do this.
  // Only return children for the onboarding or onboarding-brief pages: /[emailAccountId]/onboarding or /[emailAccountId]/onboarding-brief
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length === 2 &&
    (segments[1] === "onboarding" || segments[1] === "onboarding-brief")
  )
    return children;

  return (
    <SidebarProvider
      defaultOpen={defaultOpen ? ["left-sidebar"] : []}
      sidebarNames={["left-sidebar", "chat-sidebar"]}
      keyboardShortcutName="left-sidebar"
    >
      {/* Mail supplies its own sidebar and trigger for this shared state, so
          the global navigation and its mobile header would be duplicates. */}
      {!isMailRoute && (
        <>
          <MobileHeader />
          <SideNav name="left-sidebar" feedbackEnabled={feedbackEnabled} />
        </>
      )}
      <ContentWrapper chatWidth={chatWidth}>{children}</ContentWrapper>
      {!isAssistantRoute ? (
        <SidebarRight
          name="chat-sidebar"
          width={chatWidth}
          onWidthChange={setChatWidth}
        />
      ) : null}
    </SidebarProvider>
  );
}

function MobileHeader() {
  return (
    <header className="pointer-events-none fixed top-0 left-0 right-0 z-50 h-9 md:hidden">
      <div className="flex h-full items-center px-4">
        <SidebarTrigger
          name="left-sidebar"
          className="pointer-events-auto size-6"
        />
      </div>
    </header>
  );
}
