"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Background } from "./Background";
import { BootSequence } from "./BootSequence";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "./CommandPalette";
import { DashboardView } from "./views/DashboardView";
import { AgentsView } from "./views/AgentsView";
import { ConsoleView } from "./views/ConsoleView";
import { GoalsView } from "./views/GoalsView";
import { JournalView } from "./views/JournalView";
import { MemoryView } from "./views/MemoryView";
import { TasksView } from "./views/TasksView";
import { StudioView } from "./views/StudioView";
import { WorkspaceView } from "./views/WorkspaceView";
import { SessionsView } from "./views/SessionsView";
import { SEOView } from "./views/SEOView";
import { ActivityView } from "./views/ActivityView";
import { GuideView } from "./views/GuideView";
import { SettingsView } from "./views/SettingsView";

export function AppShell() {
  const { view } = useStore();

  const isConsole = view === "console";

  return (
    <>
      <Background />
      <BootSequence />
      <CommandPalette />

      <div className="flex h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="relative z-10 min-h-0 flex-1 px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="h-full"
              >
                {isConsole ? (
                  <div className="h-full">
                    <ConsoleView />
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto pr-1">
                    {view === "dashboard" && <DashboardView />}
                    {view === "agents" && <AgentsView />}
                    {view === "goals" && <GoalsView />}
                    {view === "journal" && <JournalView />}
                    {view === "memory" && <MemoryView />}
                    {view === "tasks" && <TasksView />}
                    {view === "studio" && <StudioView />}
                    {view === "workspace" && <WorkspaceView />}
                    {view === "sessions" && <SessionsView />}
                    {view === "seo" && <SEOView />}
                    {view === "activity" && <ActivityView />}
                    {view === "guide" && <GuideView />}
                    {view === "settings" && <SettingsView />}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  );
}
