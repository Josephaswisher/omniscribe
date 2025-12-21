import React from "react";
import { motion } from "framer-motion";
import {
  Home,
  FolderOpen,
  Mic,
  Search,
  CheckSquare,
  MessageCircle,
} from "lucide-react";
import { TabId, TabBarProps } from "../types";

const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: "home", icon: Home, label: "Home" },
  { id: "folders", icon: FolderOpen, label: "Folders" },
  { id: "record", icon: Mic, label: "Record" },
  { id: "search", icon: Search, label: "Search" },
  { id: "actions", icon: CheckSquare, label: "Actions" },
];

const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabChange,
  onOpenAssistant,
  pendingActionsCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-4 mb-4 bg-terminal-surface/95 backdrop-blur-xl border border-terminal-border rounded-xl shadow-2xl shadow-black/40">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isRecordTab = tab.id === "record";
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-4 transition-all duration-200 ${
                  isRecordTab ? "px-2" : ""
                }`}
              >
                {isRecordTab ? (
                  <div className="flex items-end gap-2 -mt-6">
                    {/* Ask OmniScribe button */}
                    {onOpenAssistant && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAssistant();
                        }}
                        className="w-10 h-10 rounded-lg bg-terminal-surface border border-terminal-border flex items-center justify-center shadow-md hover:border-rgb-purple hover:bg-terminal-hover transition-all"
                        title="Ask OmniScribe"
                      >
                        <MessageCircle className="w-4 h-4 text-rgb-purple" />
                      </motion.button>
                    )}
                    {/* Record button */}
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 border ${
                        isActive
                          ? "bg-rgb-red border-rgb-red glow-red"
                          : "bg-terminal-hover border-terminal-border hover:border-rgb-cyan"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${isActive ? "text-white" : "text-rgb-cyan"}`}
                      />
                    </motion.div>
                  </div>
                ) : (
                  <>
                    <motion.div
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      className="relative"
                    >
                      <Icon
                        className={`w-5 h-5 transition-colors duration-200 ${
                          isActive ? "text-rgb-cyan" : "text-neutral-500"
                        }`}
                      />
                      {tab.id === "actions" && pendingActionsCount > 0 && (
                        <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] bg-rgb-red text-white text-[9px] font-mono font-bold rounded flex items-center justify-center px-0.5">
                          {pendingActionsCount > 99
                            ? "99+"
                            : pendingActionsCount}
                        </span>
                      )}
                    </motion.div>
                    <span
                      className={`text-[10px] mt-1 font-mono font-medium transition-colors duration-200 ${
                        isActive ? "text-rgb-cyan" : "text-neutral-600"
                      }`}
                    >
                      {tab.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute bottom-0 w-4 h-0.5 bg-rgb-cyan rounded-full"
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default TabBar;
