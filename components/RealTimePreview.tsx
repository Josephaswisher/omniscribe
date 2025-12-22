import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Template } from "../types";
import { streamTemplatePreview } from "../geminiService";

interface RealTimePreviewProps {
  transcript: string;
  template: Template;
  isVisible: boolean;
  onToggle: () => void;
}

const RealTimePreview: React.FC<RealTimePreviewProps> = ({
  transcript,
  template,
  isVisible,
  onToggle,
}) => {
  const [preview, setPreview] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const handleStream = async () => {
    if (!transcript || isStreaming) return;
    setIsStreaming(true);
    setPreview("");
    abortRef.current = false;

    try {
      await streamTemplatePreview(
        transcript,
        template.systemPrompt,
        (chunk) => {
          if (abortRef.current) return;
          setPreview((prev) => prev + chunk);
          // Auto-scroll to bottom
          if (previewRef.current) {
            previewRef.current.scrollTop = previewRef.current.scrollHeight;
          }
        }
      );
    } catch (error) {
      if (!abortRef.current) {
        console.error("Stream error:", error);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    setIsStreaming(false);
  };

  const handleCopy = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // Auto-start preview when made visible
    if (isVisible && !preview && !isStreaming) {
      handleStream();
    }
  }, [isVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 text-xs bg-terminal-hover rounded-lg text-neutral-400 hover:text-white transition-colors"
      >
        <Eye className="w-3.5 h-3.5" />
        Preview
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-terminal-border bg-terminal-hover/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white">
            Real-time Preview: {template.name}
          </span>
          {isStreaming && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">Streaming...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleStream}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-terminal-surface text-neutral-400 rounded hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Regenerate
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!preview}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-terminal-surface text-neutral-400 rounded hover:text-white transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onToggle}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-terminal-surface text-neutral-400 rounded hover:text-white transition-colors"
          >
            <EyeOff className="w-3 h-3" />
            Hide
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div
        ref={previewRef}
        className="p-4 max-h-[300px] overflow-y-auto"
      >
        {preview ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-200 leading-relaxed">
              {preview}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse ml-0.5" />
              )}
            </pre>
          </div>
        ) : isStreaming ? (
          <div className="flex items-center justify-center gap-2 py-8 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating preview...</span>
          </div>
        ) : (
          <div className="text-center py-8 text-neutral-500">
            <p>Click "Regenerate" to see a real-time preview</p>
          </div>
        )}
      </div>

      {/* Word count */}
      {preview && (
        <div className="px-4 pb-3 border-t border-terminal-border pt-2">
          <span className="text-xs text-neutral-500">
            {preview.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default RealTimePreview;
