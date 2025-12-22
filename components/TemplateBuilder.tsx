import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  FileText,
  Briefcase,
  Lightbulb,
  PenTool,
  Users,
  Sparkles,
  Copy,
  Trash2,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Template, Parser } from "../types";

interface TemplateBuilderProps {
  templates: Template[];
  parsers: Parser[];
  onBack: () => void;
  onCreateTemplate: (
    template: Omit<Template, "id" | "createdAt" | "usageCount">,
  ) => void;
  onUpdateTemplate: (id: string, updates: Partial<Template>) => void;
  onDeleteTemplate: (id: string) => void;
  onUseAsParser: (template: Template) => void;
}

const categoryIcons: Record<string, React.ElementType> = {
  default: FileText,
  productivity: Briefcase,
  creative: PenTool,
  professional: Users,
  medical: Briefcase,
  custom: Sparkles,
};

const templatePresets = [
  // Medical Templates
  {
    name: "Admission Note (H&P)",
    description: "Complete admission history and physical examination",
    systemPrompt: `You are a medical scribe. Transform the transcript into a structured admission note:

## Chief Complaint
One sentence describing why the patient is being admitted.

## History of Present Illness (HPI)
Detailed narrative of the present illness including onset, duration, quality, severity, location, aggravating/alleviating factors, and associated symptoms.

## Past Medical History
List chronic conditions and prior hospitalizations.

## Past Surgical History
List prior surgeries with dates if mentioned.

## Medications
List current medications with doses if mentioned.

## Allergies
List allergies and reactions.

## Social History
Tobacco, alcohol, drug use, occupation, living situation.

## Family History
Relevant family medical history.

## Review of Systems
Organize by system (Constitutional, HEENT, Cardiovascular, Respiratory, GI, GU, Musculoskeletal, Neurological, Psychiatric, Skin).

## Physical Examination
Document vital signs and exam findings by system.

## Assessment
Numbered problem list with working diagnoses.

## Plan
Numbered plan corresponding to each problem.`,
    icon: "briefcase",
    category: "medical" as const,
  },
  {
    name: "Progress Note (SOAP)",
    description: "Daily progress note in SOAP format",
    systemPrompt: `You are a medical scribe. Transform the transcript into a SOAP note:

## Subjective
Patient's reported symptoms, concerns, overnight events, and how they are feeling today.

## Objective
- Vital Signs: T, HR, BP, RR, SpO2
- Physical Exam: Pertinent positive and negative findings
- Labs/Studies: Recent results and trends
- I/O: Intake and output if relevant

## Assessment
Numbered problem list with current status (improving, stable, worsening) and brief reasoning.

## Plan
Numbered plan for each problem including:
- Diagnostic workup
- Therapeutic interventions
- Consultations
- Disposition/discharge planning`,
    icon: "briefcase",
    category: "medical" as const,
  },
  {
    name: "Attestation",
    description: "Attending physician attestation statement",
    systemPrompt: `You are a medical scribe. Create an attending attestation statement:

## Attestation

I have personally seen and examined the patient. I have reviewed the resident/APP note and agree with the documented history, physical examination, and medical decision making with the following additions/modifications:

[Include any additional findings, clarifications, or changes to the assessment and plan]

I was physically present for the key portions of the encounter and actively participated in the management of this patient.

Time spent on this encounter: [X] minutes, of which greater than 50% was spent in counseling and coordination of care.

[Include discussion points if counseling/coordination dominated the visit]`,
    icon: "briefcase",
    category: "medical" as const,
  },
  {
    name: "Procedure Note",
    description: "Structured procedure documentation",
    systemPrompt: `You are a medical scribe. Transform the transcript into a procedure note:

## Procedure Note

**Procedure:** [Name of procedure]
**Date/Time:** [Date and time performed]
**Operator:** [Performing physician]
**Assistant:** [If applicable]

**Indication:** Brief clinical indication for the procedure.

**Consent:** Informed consent obtained, risks/benefits/alternatives discussed.

**Timeout:** Timeout performed, correct patient/procedure/site confirmed.

**Anesthesia:** Type of anesthesia/sedation used.

**Procedure Details:**
Step-by-step description of what was performed.

**Specimens:** Any specimens obtained and where sent.

**Estimated Blood Loss:** [Amount]

**Complications:** None, or describe complications.

**Disposition:** Patient's condition post-procedure.

**Follow-up:** Post-procedure instructions and follow-up plan.`,
    icon: "briefcase",
    category: "medical" as const,
  },
  {
    name: "Discharge Summary",
    description: "Comprehensive discharge documentation",
    systemPrompt: `You are a medical scribe. Transform the transcript into a discharge summary:

## Discharge Summary

**Admission Date:**
**Discharge Date:**
**Attending Physician:**

## Admission Diagnosis
Primary diagnosis leading to admission.

## Discharge Diagnoses
Numbered list of all diagnoses addressed during hospitalization.

## Hospital Course
Narrative summary of the hospitalization organized by problem, including key events, consultations, procedures, and response to treatment.

## Discharge Medications
Complete medication list with doses, frequencies, and any changes from admission (NEW, CHANGED, STOPPED).

## Discharge Instructions
- Activity restrictions
- Diet
- Wound care if applicable
- Warning signs to watch for

## Follow-up Appointments
Specific appointments with dates, times, and provider names.

## Pending Results
Any labs, studies, or pathology results still pending at discharge.`,
    icon: "briefcase",
    category: "medical" as const,
  },
  // General Templates
  {
    name: "Meeting Notes",
    description:
      "Extract key points, decisions, and action items from meetings",
    systemPrompt:
      "You are a professional meeting scribe. Analyze the transcript and extract:\n\n## Key Discussion Points\n- List the main topics discussed\n\n## Decisions Made\n- List any decisions that were agreed upon\n\n## Action Items\n- List tasks with assignees if mentioned\n\n## Follow-ups\n- List items that need follow-up",
    icon: "users",
    category: "professional" as const,
  },
  {
    name: "Brainstorm Ideas",
    description: "Organize creative ideas into themes and priorities",
    systemPrompt:
      "You are a creative thinking assistant. Organize the brainstorming session:\n\n## Main Themes\nGroup ideas into major themes\n\n## Top Ideas\nHighlight the most promising concepts\n\n## Questions to Explore\nList open questions worth investigating\n\n## Next Steps\nSuggest concrete next actions",
    icon: "lightbulb",
    category: "creative" as const,
  },
  {
    name: "Daily Journal",
    description: "Transform rambling thoughts into a structured journal entry",
    systemPrompt:
      "You are an introspective journal editor. Transform the transcript into a thoughtful first-person journal entry:\n\n## Today's Reflection\nWrite a cohesive narrative of the day's thoughts\n\n## Gratitude\nExtract any positive moments or things to be grateful for\n\n## Insights\nHighlight any realizations or lessons learned\n\n## Tomorrow's Intentions\nSummarize any forward-looking thoughts",
    icon: "pen-tool",
    category: "creative" as const,
  },
  {
    name: "Project Update",
    description: "Structure project status updates for stakeholders",
    systemPrompt:
      "You are a project management assistant. Structure the update:\n\n## Progress Summary\nBrief overview of current status\n\n## Completed This Week\nList accomplishments\n\n## In Progress\nList ongoing work\n\n## Blockers/Risks\nHighlight any issues\n\n## Next Steps\nOutline upcoming priorities",
    icon: "briefcase",
    category: "productivity" as const,
  },
];

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  templates,
  parsers,
  onBack,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onUseAsParser,
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    icon: "file-text",
    category: "custom" as Template["category"],
  });
  const [previewMode, setPreviewMode] = useState(false);

  const openEditor = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description,
        systemPrompt: template.systemPrompt,
        icon: template.icon,
        category: template.category,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: "",
        description: "",
        systemPrompt: "",
        icon: "file-text",
        category: "custom",
      });
    }
    setShowEditor(true);
  };

  const usePreset = (preset: (typeof templatePresets)[0]) => {
    setEditingTemplate(null);
    setFormData({
      name: preset.name,
      description: preset.description,
      systemPrompt: preset.systemPrompt,
      icon: preset.icon,
      category: preset.category,
    });
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.systemPrompt) return;

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, formData);
    } else {
      onCreateTemplate(formData);
    }
    setShowEditor(false);
  };

  const TemplateCard: React.FC<{ template: Template }> = ({ template }) => {
    const Icon = categoryIcons[template.category] || FileText;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-terminal-surface border border-white/5 rounded-xl p-4 hover:bg-terminal-hover transition-all group"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-rgb-cyan/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => openEditor(template)}
              className="p-1.5 rounded-lg bg-terminal-hover text-neutral-400 hover:text-white"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onUseAsParser(template)}
              className="p-1.5 rounded-lg bg-rgb-cyan/20 text-indigo-400 hover:bg-rgb-cyan/30"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <h3 className="text-slate-100 font-semibold mb-1">{template.name}</h3>
        <p className="text-sm text-neutral-500 line-clamp-2 mb-3">
          {template.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 bg-terminal-hover px-2 py-0.5 rounded">
            {template.category}
          </span>
          {template.usageCount !== undefined && template.usageCount > 0 && (
            <span className="text-xs text-neutral-500">
              Used {template.usageCount}x
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-terminal-bg">
      {/* Header */}
      <header className="safe-top px-4 py-4 border-b border-terminal-border">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-terminal-surface flex items-center justify-center"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
          <h1 className="text-lg font-bold text-white">Template Builder</h1>
          <button
            onClick={() => openEditor()}
            className="w-10 h-10 rounded-full bg-rgb-cyan flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto safe-bottom p-4">
        {/* Presets Section */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">
            Quick Start Templates
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {templatePresets.map((preset, i) => {
              const Icon = categoryIcons[preset.category];
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => usePreset(preset)}
                  className="bg-terminal-surface/30 border border-terminal-border rounded-xl p-4 text-left hover:border-indigo-500/30 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-rgb-cyan/10 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-neutral-100 font-medium text-sm mb-1">
                    {preset.name}
                  </h3>
                  <p className="text-xs text-neutral-500 line-clamp-2">
                    {preset.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Custom Templates */}
        <section>
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">
            Your Templates
          </h2>
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <p className="text-neutral-400">No custom templates yet</p>
              <p className="text-sm text-neutral-500 mt-1">
                Create one from scratch or use a preset
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-terminal-bg"
          >
            <header className="safe-top px-4 py-4 border-b border-terminal-border flex items-center justify-between">
              <button
                onClick={() => setShowEditor(false)}
                className="w-10 h-10 rounded-full bg-terminal-surface flex items-center justify-center"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
              <h2 className="text-lg font-bold text-white">
                {editingTemplate ? "Edit Template" : "New Template"}
              </h2>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`p-2 rounded-lg ${previewMode ? "bg-rgb-cyan text-white" : "bg-terminal-surface text-neutral-400"}`}
              >
                <Eye className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto safe-bottom p-4 space-y-6">
              {/* Name */}
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-2 block">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="My Template"
                  className="w-full px-4 py-3 bg-terminal-surface border border-terminal-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-2 block">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="What does this template do?"
                  className="w-full px-4 py-3 bg-terminal-surface border border-terminal-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-2 block">
                  Category
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      "medical",
                      "productivity",
                      "creative",
                      "professional",
                      "custom",
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setFormData((f) => ({ ...f, category: cat }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                        formData.category === cat
                          ? "bg-rgb-cyan text-white"
                          : "bg-terminal-surface text-neutral-400"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-sm font-medium text-neutral-400 mb-2 block">
                  System Prompt
                  <span className="text-neutral-500 font-normal ml-2">
                    (Instructions for the AI)
                  </span>
                </label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, systemPrompt: e.target.value }))
                  }
                  placeholder="You are a helpful assistant. Take the transcript and..."
                  rows={10}
                  className="w-full px-4 py-3 bg-terminal-surface border border-terminal-border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                {editingTemplate && (
                  <button
                    onClick={() => {
                      if (confirm("Delete this template?")) {
                        onDeleteTemplate(editingTemplate.id);
                        setShowEditor(false);
                      }
                    }}
                    className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl font-medium hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.systemPrompt}
                  className="flex-1 py-3 bg-rgb-cyan text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-400"
                >
                  {editingTemplate ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TemplateBuilder;
