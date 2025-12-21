import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Home,
  FolderOpen,
  Mic,
  Search,
  CheckSquare,
  Upload,
  Loader2,
} from "lucide-react";
import { TabId, TabBarProps } from "../types";
import { useToast, UploadErrors } from "./Toast";

// Supported audio MIME types
const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/mp4a-latm",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
];
const ACCEPTED_EXTENSIONS = [".mp3", ".mp4", ".m4a", ".wav", ".webm", ".ogg"];
const MAX_SIZE_MB = 100;
const MAX_DURATION_MIN = 30;

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
  onUploadFile,
  isUploading = false,
  pendingActionsCount = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const { showError } = useToast();

  // Extract audio duration using Web Audio API
  const extractDuration = useCallback(async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioContext.close();
          resolve(audioBuffer.duration);
        } catch {
          audioContext.close();
          // Fallback to audio element
          const audio = new Audio();
          audio.src = URL.createObjectURL(file);
          audio.onloadedmetadata = () => {
            URL.revokeObjectURL(audio.src);
            resolve(audio.duration);
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audio.src);
            reject(new Error("Could not read audio duration"));
          };
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // Process file with validation
  const processFile = useCallback(
    async (file: File) => {
      if (!onUploadFile) return;

      // Validate extension
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        const error = UploadErrors.UNSUPPORTED_FORMAT(ACCEPTED_EXTENSIONS);
        showError(error.title, error.description);
        return;
      }

      // Validate size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > MAX_SIZE_MB) {
        const error = UploadErrors.FILE_TOO_LARGE(sizeMB, MAX_SIZE_MB);
        showError(error.title, error.description);
        return;
      }

      setValidating(true);
      setLastFile(file);

      try {
        const duration = await extractDuration(file);
        const durationMinutes = duration / 60;

        if (durationMinutes > MAX_DURATION_MIN) {
          const error = UploadErrors.DURATION_TOO_LONG(
            durationMinutes,
            MAX_DURATION_MIN,
          );
          showError(error.title, error.description);
          setValidating(false);
          return;
        }

        onUploadFile(file, duration);
        setLastFile(null);
      } catch (err) {
        console.error("[TabBar] Audio file read error:", err);
        showError(
          UploadErrors.CORRUPTED_FILE.title,
          UploadErrors.CORRUPTED_FILE.description,
          () => {
            // Retry: re-trigger file picker
            fileInputRef.current?.click();
          },
        );
      } finally {
        setValidating(false);
      }
    },
    [onUploadFile, extractDuration, showError],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      processFile(file);
    },
    [processFile],
  );

  const handleUploadClick = () => {
    if (!validating && !isUploading) {
      fileInputRef.current?.click();
    }
  };
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
                    {/* Upload Button - Left of Record */}
                    {onUploadFile && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_TYPES.join(",")}
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUploadClick();
                          }}
                          disabled={validating || isUploading}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md transition-all duration-300 border ${
                            validating || isUploading
                              ? "bg-rgb-cyan/20 border-rgb-cyan animate-pulse"
                              : "bg-terminal-surface border-terminal-border hover:border-rgb-cyan hover:bg-terminal-hover"
                          }`}
                          title="Upload audio file"
                        >
                          {validating || isUploading ? (
                            <Loader2 className="w-4 h-4 text-rgb-cyan animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 text-rgb-cyan" />
                          )}
                        </motion.button>
                      </>
                    )}

                    {/* Record Button - Main FAB */}
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
