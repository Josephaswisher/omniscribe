import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Copy,
  FlaskConical,
  AlertOctagon,
} from "lucide-react";
import { generateDifferential, DifferentialResult, DifferentialItem } from "../geminiService";

interface DifferentialGeneratorProps {
  transcript: string;
}

const likelihoodColors = {
  high: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
  moderate: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  low: { bg: "bg-neutral-500/20", text: "text-neutral-400", border: "border-neutral-500/30" },
};

const DifferentialGenerator: React.FC<DifferentialGeneratorProps> = ({ transcript }) => {
  const [result, setResult] = useState<DifferentialResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDx, setExpandedDx] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!transcript || isLoading) return;
    setIsLoading(true);
    try {
      const diff = await generateDifferential(transcript);
      setResult(diff);
      if (diff.differentials.length > 0) {
        setExpandedDx(diff.differentials[0].diagnosis);
      }
    } catch (error) {
      console.error("Failed to generate differential:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = formatForCopy(result);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatForCopy = (r: DifferentialResult): string => {
    let text = `DIFFERENTIAL DIAGNOSIS\n${"=".repeat(40)}\n\n`;
    text += `Chief Complaint: ${r.chiefComplaint}\n\n`;
    text += `DIFFERENTIALS:\n`;
    r.differentials.forEach((d, i) => {
      text += `\n${i + 1}. ${d.diagnosis} (${d.likelihood} likelihood)\n`;
      if (d.supportingFindings.length) {
        text += `   Supporting: ${d.supportingFindings.join(", ")}\n`;
      }
      if (d.contradictingFindings.length) {
        text += `   Against: ${d.contradictingFindings.join(", ")}\n`;
      }
      if (d.suggestedWorkup.length) {
        text += `   Workup: ${d.suggestedWorkup.join(", ")}\n`;
      }
    });
    if (r.redFlags.length) {
      text += `\nRED FLAGS:\n- ${r.redFlags.join("\n- ")}\n`;
    }
    if (r.criticalActions.length) {
      text += `\nCRITICAL ACTIONS:\n- ${r.criticalActions.join("\n- ")}\n`;
    }
    return text;
  };

  if (!result) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGenerate}
        disabled={isLoading || !transcript}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 rounded-xl text-purple-400 hover:from-purple-600/30 hover:to-indigo-600/30 transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating Differential...</span>
          </>
        ) : (
          <>
            <Stethoscope className="w-5 h-5" />
            <span>Generate Differential Diagnosis</span>
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
          <Stethoscope className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">Differential Diagnosis</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-terminal-hover rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-500/20 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-colors"
          >
            <Loader2 className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Chief Complaint */}
      <div className="p-4 bg-terminal-hover/50">
        <span className="text-xs font-medium text-neutral-500 uppercase">Chief Complaint</span>
        <p className="text-white mt-1">{result.chiefComplaint}</p>
      </div>

      {/* Red Flags */}
      {result.redFlags.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Red Flags</span>
          </div>
          <ul className="space-y-1">
            {result.redFlags.map((flag, i) => (
              <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical Actions */}
      {result.criticalActions.length > 0 && (
        <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Critical Actions</span>
          </div>
          <ul className="space-y-1">
            {result.criticalActions.map((action, i) => (
              <li key={i} className="text-sm text-amber-300 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Differentials */}
      <div className="p-4 space-y-3">
        <span className="text-xs font-medium text-neutral-500 uppercase">
          Differentials ({result.differentials.length})
        </span>
        {result.differentials.map((dx, index) => (
          <DifferentialCard
            key={dx.diagnosis}
            dx={dx}
            rank={index + 1}
            isExpanded={expandedDx === dx.diagnosis}
            onToggle={() => setExpandedDx(expandedDx === dx.diagnosis ? null : dx.diagnosis)}
          />
        ))}
      </div>
    </div>
  );
};

const DifferentialCard: React.FC<{
  dx: DifferentialItem;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ dx, rank, isExpanded, onToggle }) => {
  const colors = likelihoodColors[dx.likelihood];

  return (
    <motion.div
      layout
      className={`border rounded-xl overflow-hidden ${colors.border}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-terminal-hover/50 transition-colors"
      >
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colors.bg} ${colors.text}`}>
          {rank}
        </span>
        <span className="flex-1 text-left text-white font-medium">{dx.diagnosis}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
          {dx.likelihood}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-terminal-border overflow-hidden"
          >
            <div className="p-3 space-y-3 bg-terminal-hover/30">
              {/* Supporting Findings */}
              {dx.supportingFindings.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs font-medium text-green-400">Supporting</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dx.supportingFindings.map((finding, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-green-500/10 text-green-300 text-xs rounded"
                      >
                        {finding}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contradicting Findings */}
              {dx.contradictingFindings.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-400">Against</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dx.contradictingFindings.map((finding, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-red-500/10 text-red-300 text-xs rounded"
                      >
                        {finding}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Workup */}
              {dx.suggestedWorkup.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-medium text-indigo-400">Workup</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {dx.suggestedWorkup.map((test, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-indigo-500/10 text-indigo-300 text-xs rounded"
                      >
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DifferentialGenerator;
