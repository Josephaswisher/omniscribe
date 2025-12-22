import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Sparkles,
  Plus,
  Star,
  ChevronDown,
  Loader2,
  Copy,
  Check,
  X,
  PenTool,
  ClipboardList,
} from "lucide-react";
import { Template, TemplateOutput } from "../types";

interface TemplateOutputTabsProps {
  rawTranscript?: string;
  summary?: string;
  templateOutputs?: TemplateOutput[];
  templates: Template[];
  isGenerating: boolean;
  onApplyTemplate: (template: Template) => void;
  onCreateTemplate: () => void;
  onToggleFavorite: (templateId: string) => void;
}

type TabType = "raw" | "summary" | string;

const TemplateOutputTabs: React.FC<TemplateOutputTabsProps> = ({
  rawTranscript,
  summary,
  templateOutputs = [],
  templates,
  isGenerating,
  onApplyTemplate,
  onCreateTemplate,
  onToggleFavorite,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("raw");
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const favoriteTemplates = templates.filter((t) => t.isFavorite);
  const otherTemplates = templates.filter((t) => !t.isFavorite);

  const handleCopy = async (
    content: string,
    tabId: string,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 1500);
  };

  const getContentForTab = (tabId: string) => {
    if (tabId === "raw") return rawTranscript || "";
    if (tabId === "summary") return summary || "";
    const output = templateOutputs.find((o) => o.templateId === tabId);
    return output?.output || "";
  };

  const getActiveContent = () => getContentForTab(activeTab);

  const handleCopyAll = async () => {
    const parts: string[] = [];
    if (rawTranscript) {
      parts.push("=== RAW TRANSCRIPT ===\n" + rawTranscript);
    }
    if (summary) {
      parts.push("=== SUMMARY ===\n" + summary);
    }
    templateOutputs.forEach((output) => {
      parts.push(
        `=== ${output.templateName.toUpperCase()} ===\n` + output.output,
      );
    });
    await navigator.clipboard.writeText(parts.join("\n\n"));
    setCopiedTab("all");
    setTimeout(() => setCopiedTab(null), 1500);
  };

  return (
    <div className="flex flex-col">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3 border-b border-terminal-border">
        {/* Raw Tab */}
        <div className="flex items-center group">
          <button
            onClick={() => setActiveTab("raw")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-l-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === "raw"
                ? "bg-terminal-surface text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Raw
          </button>
          <button
            onClick={(e) => handleCopy(rawTranscript || "", "raw", e)}
            className={`p-2 rounded-r-lg transition-colors ${
              activeTab === "raw" ? "bg-terminal-surface" : "bg-transparent"
            } ${copiedTab === "raw" ? "text-green-400" : "text-neutral-500 hover:text-white"}`}
            title="Copy Raw (⌘C)"
          >
            {copiedTab === "raw" ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Summary Tab */}
        {summary && (
          <div className="flex items-center group">
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-l-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === "summary"
                  ? "bg-terminal-surface text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Summary
            </button>
            <button
              onClick={(e) => handleCopy(summary, "summary", e)}
              className={`p-2 rounded-r-lg transition-colors ${
                activeTab === "summary"
                  ? "bg-terminal-surface"
                  : "bg-transparent"
              } ${copiedTab === "summary" ? "text-green-400" : "text-neutral-500 hover:text-white"}`}
              title="Copy Summary"
            >
              {copiedTab === "summary" ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Template Output Tabs */}
        {templateOutputs.map((output) => (
          <div key={output.templateId} className="flex items-center group">
            <button
              onClick={() => setActiveTab(output.templateId)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-l-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === output.templateId
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              {output.templateName}
            </button>
            <button
              onClick={(e) => handleCopy(output.output, output.templateId, e)}
              className={`p-2 rounded-r-lg transition-colors ${
                activeTab === output.templateId
                  ? "bg-indigo-500/20"
                  : "bg-transparent"
              } ${copiedTab === output.templateId ? "text-green-400" : "text-neutral-500 hover:text-indigo-400"}`}
              title={`Copy ${output.templateName}`}
            >
              {copiedTab === output.templateId ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ))}

        {/* Copy All Button */}
        {(rawTranscript || summary || templateOutputs.length > 0) && (
          <button
            onClick={handleCopyAll}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              copiedTab === "all"
                ? "bg-green-500/20 text-green-400"
                : "bg-terminal-surface/50 text-neutral-400 hover:text-white hover:bg-terminal-surface"
            }`}
            title="Copy All Content"
          >
            {copiedTab === "all" ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <ClipboardList className="w-3.5 h-3.5" />
            )}
            {copiedTab === "all" ? "Copied!" : "Copy All"}
          </button>
        )}

        {/* Add Template Button */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-rgb-cyan/10 text-indigo-400 hover:bg-rgb-cyan/20 transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Apply Template
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Template Dropdown Menu */}
          <AnimatePresence>
            {showTemplateMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-72 bg-terminal-surface border border-terminal-border rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="max-h-80 overflow-y-auto">
                  {/* Favorites Section */}
                  {favoriteTemplates.length > 0 && (
                    <div className="p-2 border-b border-terminal-border">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 px-2 py-1">
                        Favorites
                      </div>
                      {favoriteTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => {
                            onApplyTemplate(template);
                            setShowTemplateMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-terminal-hover text-left group"
                        >
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-neutral-100 truncate">
                              {template.name}
                            </div>
                            <div className="text-xs text-neutral-500 truncate">
                              {template.description}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(template.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-terminal-surface rounded"
                          >
                            <X className="w-3 h-3 text-neutral-400" />
                          </button>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* All Templates */}
                  <div className="p-2">
                    {favoriteTemplates.length > 0 && (
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 px-2 py-1">
                        All Templates
                      </div>
                    )}
                    {otherTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          onApplyTemplate(template);
                          setShowTemplateMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-terminal-hover text-left group"
                      >
                        <FileText className="w-4 h-4 text-neutral-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-neutral-100 truncate">
                            {template.name}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {template.description}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(template.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-terminal-surface rounded"
                        >
                          <Star className="w-3 h-3 text-neutral-400 hover:text-amber-400" />
                        </button>
                      </button>
                    ))}

                    {templates.length === 0 && (
                      <div className="text-center py-4 text-neutral-500 text-sm">
                        No templates yet
                      </div>
                    )}
                  </div>

                  {/* Create New */}
                  <div className="p-2 border-t border-terminal-border">
                    <button
                      onClick={() => {
                        onCreateTemplate();
                        setShowTemplateMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-rgb-cyan/10 text-indigo-400 hover:bg-rgb-cyan/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Add My Own Template
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {/* Copy Button */}
        <button
          onClick={() => handleCopy(getActiveContent(), activeTab)}
          className="absolute top-2 right-2 p-2 rounded-lg bg-terminal-surface/80 text-neutral-400 hover:text-white transition-colors z-10"
        >
          {copiedTab === activeTab ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>

        {/* Content */}
        <div className="bg-terminal-surface/30 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {isGenerating &&
              activeTab !== "raw" &&
              activeTab !== "summary" ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <span className="ml-2 text-neutral-400">Generating...</span>
                </div>
              ) : (
                <p className="text-neutral-100 leading-relaxed whitespace-pre-wrap text-sm">
                  {getActiveContent() || "No content available"}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TemplateOutputTabs;
