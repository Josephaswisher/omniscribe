import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SpellCheck,
  Loader2,
  Check,
  X,
  Pill,
  Activity,
  Scissors,
  Heart,
  FileText,
  AlertCircle,
} from "lucide-react";
import { checkMedicalSpelling, MedicalSpellCheckResult } from "../geminiService";

interface MedicalSpellCheckProps {
  text: string;
  onApplyCorrection?: (original: string, suggestion: string) => void;
}

const categoryConfig = {
  medication: { icon: Pill, color: "text-blue-400", bg: "bg-blue-500/20" },
  diagnosis: { icon: Activity, color: "text-purple-400", bg: "bg-purple-500/20" },
  procedure: { icon: Scissors, color: "text-green-400", bg: "bg-green-500/20" },
  anatomy: { icon: Heart, color: "text-red-400", bg: "bg-red-500/20" },
  abbreviation: { icon: FileText, color: "text-amber-400", bg: "bg-amber-500/20" },
  general: { icon: AlertCircle, color: "text-neutral-400", bg: "bg-neutral-500/20" },
};

const MedicalSpellCheck: React.FC<MedicalSpellCheckProps> = ({ text, onApplyCorrection }) => {
  const [results, setResults] = useState<MedicalSpellCheckResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [appliedCorrections, setAppliedCorrections] = useState<Set<string>>(new Set());

  const handleCheck = async () => {
    if (!text || isLoading) return;
    setIsLoading(true);
    setAppliedCorrections(new Set());
    try {
      const spellResults = await checkMedicalSpelling(text);
      setResults(spellResults);
      setHasChecked(true);
    } catch (error) {
      console.error("Spell check failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (result: MedicalSpellCheckResult) => {
    if (onApplyCorrection) {
      onApplyCorrection(result.original, result.suggestion);
      setAppliedCorrections((prev) => new Set([...prev, result.original]));
    }
  };

  const handleDismiss = (original: string) => {
    setResults((prev) => prev.filter((r) => r.original !== original));
  };

  if (!hasChecked) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCheck}
        disabled={isLoading || !text}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-cyan-600/20 to-teal-600/20 border border-cyan-500/30 rounded-xl text-cyan-400 hover:from-cyan-600/30 hover:to-teal-600/30 transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking Medical Terms...</span>
          </>
        ) : (
          <>
            <SpellCheck className="w-5 h-5" />
            <span>Medical Spell Check</span>
          </>
        )}
      </motion.button>
    );
  }

  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <SpellCheck className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-white">Medical Spell Check</h3>
          <span className="px-2 py-0.5 bg-terminal-hover rounded text-xs text-neutral-400">
            {results.length} {results.length === 1 ? "issue" : "issues"}
          </span>
        </div>
        <button
          onClick={handleCheck}
          disabled={isLoading}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          <Loader2 className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Recheck
        </button>
      </div>

      {/* Results */}
      <div className="p-4">
        {results.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-green-400">
            <Check className="w-5 h-5" />
            <span>No spelling issues detected</span>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {results.map((result) => {
                const config = categoryConfig[result.category];
                const Icon = config.icon;
                const isApplied = appliedCorrections.has(result.original);

                return (
                  <motion.div
                    key={result.original}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`p-3 rounded-lg border ${isApplied ? "border-green-500/30 bg-green-500/10" : "border-terminal-border bg-terminal-hover/50"}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Category Icon */}
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-red-400 line-through">{result.original}</span>
                          <span className="text-neutral-500">→</span>
                          <span className="text-green-400 font-medium">{result.suggestion}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${config.bg} ${config.color}`}>
                            {result.category}
                          </span>
                        </div>
                        {result.context && (
                          <p className="text-xs text-neutral-500 mt-1 truncate">
                            ...{result.context}...
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-neutral-500">
                            {Math.round(result.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {isApplied ? (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs text-green-400">
                            <Check className="w-3.5 h-3.5" />
                            Applied
                          </span>
                        ) : (
                          <>
                            {onApplyCorrection && (
                              <button
                                onClick={() => handleApply(result)}
                                className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                title="Apply correction"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDismiss(result.original)}
                              className="p-1.5 rounded-lg bg-neutral-500/20 text-neutral-400 hover:bg-neutral-500/30 transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(categoryConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <span key={key} className="flex items-center gap-1 text-neutral-500">
                <Icon className={`w-3 h-3 ${config.color}`} />
                {key}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MedicalSpellCheck;
