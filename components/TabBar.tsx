import React from 'react';
import { motion } from 'framer-motion';
import { Home, FolderOpen, Mic, Search, CheckSquare } from 'lucide-react';
import { TabId, TabBarProps } from '../types';

const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'folders', icon: FolderOpen, label: 'Folders' },
  { id: 'record', icon: Mic, label: 'Record' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'actions', icon: CheckSquare, label: 'Actions' },
];

const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange, pendingActionsCount = 0 }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-4 mb-4 bg-slate-800/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/20">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isRecordTab = tab.id === 'record';
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-4 transition-all duration-200 ${
                  isRecordTab ? 'px-2' : ''
                }`}
              >
                {isRecordTab ? (
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`w-14 h-14 -mt-6 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                      isActive 
                        ? 'bg-red-500 shadow-red-500/40' 
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30'
                    }`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      className="relative"
                    >
                      <Icon 
                        className={`w-6 h-6 transition-colors duration-200 ${
                          isActive ? 'text-indigo-400' : 'text-slate-400'
                        }`}
                      />
                      {tab.id === 'actions' && pendingActionsCount > 0 && (
                        <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                          {pendingActionsCount > 99 ? '99+' : pendingActionsCount}
                        </span>
                      )}
                    </motion.div>
                    <span className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${
                      isActive ? 'text-indigo-400' : 'text-slate-500'
                    }`}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute bottom-0 w-1 h-1 bg-indigo-400 rounded-full"
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
