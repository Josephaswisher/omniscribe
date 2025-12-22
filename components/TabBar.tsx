import React from "react";
import { motion } from "framer-motion";
import { Home, FolderOpen, Mic, Search, CheckSquare } from "lucide-react";
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
  pendingActionsCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-4 mb-4 bg-terminal-surface/95 backdrop-blur-xl border border-terminal-border rounded-2xl shadow-2xl shadow-black/50">
        <div className="flex items-center justify-around py-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isRecordTab = tab.id === "record";
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-3 transition-all duration-200 ${
                  isRecordTab ? "px-1" : ""
                }`}
              >
                {isRecordTab ? (
                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-1 -mt-8"
                  >
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 ${
                        isActive
                          ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/40 border border-red-400/30"
                          : "bg-gradient-to-br from-cyan-500 to-teal-600 shadow-cyan-500/30 border border-cyan-400/20 hover:shadow-cyan-500/40"
                      }`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <span
                      className={`text-[9px] font-mono font-medium ${
                        isActive ? "text-red-400" : "text-cyan-400"
                      }`}
                    >
                      {isActive ? "Recording" : "Record"}
                    </span>
                  </motion.div>
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
