import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileAudio,
  X,
  AlertCircle,
  Loader2,
  CheckCircle,
} from "lucide-react";

interface AudioUploaderProps {
  onFileAccepted: (file: File, duration: number) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
  maxDurationMinutes?: number;
  compact?: boolean;
  disabled?: boolean;
}

// Supported audio MIME types
const ACCEPTED_TYPES = [
  "audio/mpeg", // MP3
  "audio/mp4", // M4A/MP4 audio
  "audio/x-m4a", // M4A (alternate)
  "audio/mp4a-latm", // M4A (alternate)
  "audio/wav", // WAV
  "audio/wave", // WAV (alternate)
  "audio/x-wav", // WAV (alternate)
  "audio/webm", // WebM
  "audio/ogg", // OGG
];

// File extensions for validation
const ACCEPTED_EXTENSIONS = [".mp3", ".mp4", ".m4a", ".wav", ".webm", ".ogg"];

type UploadState = "idle" | "validating" | "error" | "success";

const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileAccepted,
  onError,
  maxSizeMB = 100,
  maxDurationMinutes = 30,
  compact = false,
  disabled = false,
}) => {
  const [state, setState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        } catch (err) {
          audioContext.close();
          // Fallback to audio element if decodeAudioData fails
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

  // Validate file
  const validateFile = useCallback(
    async (
      file: File,
    ): Promise<{ valid: boolean; error?: string; duration?: number }> => {
      // Check file extension
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return {
          valid: false,
          error: `Unsupported format. Please use: ${ACCEPTED_EXTENSIONS.join(", ")}`,
        };
      }

      // Check MIME type (some browsers may not set it correctly)
      if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
        console.warn(
          `Unexpected MIME type: ${file.type}, but extension ${ext} is valid`,
        );
      }

      // Check file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        return {
          valid: false,
          error: `File too large (${sizeMB.toFixed(1)}MB). Maximum: ${maxSizeMB}MB`,
        };
      }

      // Extract and check duration
      try {
        const duration = await extractDuration(file);
        const durationMinutes = duration / 60;

        if (durationMinutes > maxDurationMinutes) {
          return {
            valid: false,
            error: `Recording too long (${durationMinutes.toFixed(1)} min). Maximum: ${maxDurationMinutes} minutes`,
          };
        }

        return { valid: true, duration };
      } catch (err) {
        return {
          valid: false,
          error: "Could not read audio file. Please try another file.",
        };
      }
    },
    [maxSizeMB, maxDurationMinutes, extractDuration],
  );

  // Handle file selection
  const handleFile = useCallback(
    async (file: File) => {
      if (disabled) return;

      setFileName(file.name);
      setState("validating");
      setErrorMessage("");

      const validation = await validateFile(file);

      if (!validation.valid) {
        setState("error");
        setErrorMessage(validation.error || "Invalid file");
        onError?.(validation.error || "Invalid file");
        return;
      }

      setState("success");
      onFileAccepted(file, validation.duration!);

      // Reset after a brief moment
      setTimeout(() => {
        setState("idle");
        setFileName("");
      }, 1500);
    },
    [disabled, validateFile, onFileAccepted, onError],
  );

  // Click to browse
  const handleClick = () => {
    if (!disabled && state !== "validating") {
      fileInputRef.current?.click();
    }
  };

  // File input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = "";
  };

  // Drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  // Dismiss error
  const handleDismissError = () => {
    setState("idle");
    setErrorMessage("");
    setFileName("");
  };

  // Compact button variant (for TabBar/Home)
  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleInputChange}
          className="hidden"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleClick}
          disabled={disabled || state === "validating"}
          className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
            state === "validating"
              ? "bg-rgb-cyan/20 border-rgb-cyan animate-pulse cursor-wait"
              : disabled
                ? "bg-terminal-surface border-terminal-border opacity-50 cursor-not-allowed"
                : "bg-terminal-surface border-terminal-border hover:border-rgb-cyan hover:bg-terminal-hover"
          }`}
          title="Upload audio file"
        >
          {state === "validating" ? (
            <Loader2 className="w-5 h-5 text-rgb-cyan animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-rgb-cyan" />
          )}
        </motion.button>
      </>
    );
  }

  // Full drop zone variant
  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleInputChange}
        className="hidden"
      />

      <motion.div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{
          borderColor: isDragOver
            ? "#22d3ee"
            : state === "error"
              ? "#ef4444"
              : "#262626",
          backgroundColor: isDragOver
            ? "rgba(34, 211, 238, 0.1)"
            : "transparent",
        }}
        className={`relative p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:border-terminal-muted"
        }`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <AnimatePresence mode="wait">
            {state === "validating" ? (
              <motion.div
                key="validating"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-12 h-12 rounded-xl bg-rgb-cyan/20 flex items-center justify-center"
              >
                <Loader2 className="w-6 h-6 text-rgb-cyan animate-spin" />
              </motion.div>
            ) : state === "error" ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-12 h-12 rounded-xl bg-rgb-red/20 flex items-center justify-center"
              >
                <AlertCircle className="w-6 h-6 text-rgb-red" />
              </motion.div>
            ) : state === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-12 h-12 rounded-xl bg-rgb-green/20 flex items-center justify-center"
              >
                <CheckCircle className="w-6 h-6 text-rgb-green" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  isDragOver ? "bg-rgb-cyan/20" : "bg-terminal-surface"
                }`}
              >
                {isDragOver ? (
                  <FileAudio className="w-6 h-6 text-rgb-cyan" />
                ) : (
                  <Upload className="w-6 h-6 text-neutral-500" />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            {state === "validating" ? (
              <p className="text-sm font-mono text-rgb-cyan">
                Validating <span className="text-neutral-400">{fileName}</span>
                ...
              </p>
            ) : state === "error" ? (
              <div className="space-y-1">
                <p className="text-sm font-mono text-rgb-red">{errorMessage}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismissError();
                  }}
                  className="text-xs font-mono text-neutral-500 hover:text-white underline"
                >
                  Try again
                </button>
              </div>
            ) : state === "success" ? (
              <p className="text-sm font-mono text-rgb-green">File accepted!</p>
            ) : (
              <>
                <p className="text-sm font-medium text-neutral-300">
                  {isDragOver ? "Drop to upload" : "Drop audio file here"}
                </p>
                <p className="text-xs font-mono text-neutral-500 mt-1">
                  or click to browse
                </p>
              </>
            )}
          </div>

          {state === "idle" && (
            <div className="flex gap-2 flex-wrap justify-center">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-terminal-surface border border-terminal-border text-neutral-400">
                MP3
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-terminal-surface border border-terminal-border text-neutral-400">
                M4A
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-terminal-surface border border-terminal-border text-neutral-400">
                WAV
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-terminal-surface border border-terminal-border text-neutral-400">
                WebM
              </span>
            </div>
          )}

          {state === "idle" && (
            <p className="text-[10px] font-mono text-neutral-600">
              Max {maxSizeMB}MB · {maxDurationMinutes} min
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AudioUploader;
