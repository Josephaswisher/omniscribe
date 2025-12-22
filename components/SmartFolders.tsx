import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, User, FileText, Sparkles, PenTool,
  ChevronRight, CalendarDays, CalendarRange, Archive
} from 'lucide-react';
import { VoiceNote } from '../types';
import { isToday, isThisWeek, isThisMonth, formatDistanceToNow } from 'date-fns';

interface SmartFolder {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  count: number;
  notes: VoiceNote[];
}

interface SmartFoldersProps {
  notes: VoiceNote[];
  onFolderSelect: (folder: SmartFolder) => void;
  selectedFolderId?: string;
}

const SmartFolders: React.FC<SmartFoldersProps> = ({
  notes,
  onFolderSelect,
  selectedFolderId,
}) => {
  // Extract patient identifiers from notes
  const extractPatientId = (note: VoiceNote): string | null => {
    const text = (note.transcript || '') + ' ' + (note.parsedSummary || '');
    
    // MRN patterns (various formats)
    const mrnPatterns = [
      /MRN[:\s#]*(\d{6,10})/i,
      /Medical Record[:\s#]*(\d{6,10})/i,
      /Patient ID[:\s#]*(\d{6,10})/i,
    ];
    
    for (const pattern of mrnPatterns) {
      const match = text.match(pattern);
      if (match) return `MRN: ${match[1]}`;
    }
    
    // Patient name patterns
    const namePatterns = [
      /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
      /Patient[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
      /Name[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    ];
    
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  const smartFolders = useMemo(() => {
    const folders: SmartFolder[] = [];

    // Date-based folders
    const today = notes.filter(n => isToday(n.createdAt));
    const thisWeek = notes.filter(n => !isToday(n.createdAt) && isThisWeek(n.createdAt));
    const thisMonth = notes.filter(n => !isThisWeek(n.createdAt) && isThisMonth(n.createdAt));
    const older = notes.filter(n => !isThisMonth(n.createdAt));

    if (today.length > 0) {
      folders.push({
        id: 'smart-today',
        name: 'Today',
        icon: <Clock className="w-5 h-5" />,
        color: '#22c55e',
        count: today.length,
        notes: today,
      });
    }

    if (thisWeek.length > 0) {
      folders.push({
        id: 'smart-week',
        name: 'This Week',
        icon: <CalendarDays className="w-5 h-5" />,
        color: '#3b82f6',
        count: thisWeek.length,
        notes: thisWeek,
      });
    }

    if (thisMonth.length > 0) {
      folders.push({
        id: 'smart-month',
        name: 'This Month',
        icon: <CalendarRange className="w-5 h-5" />,
        color: '#8b5cf6',
        count: thisMonth.length,
        notes: thisMonth,
      });
    }

    if (older.length > 0) {
      folders.push({
        id: 'smart-older',
        name: 'Older',
        icon: <Archive className="w-5 h-5" />,
        color: '#6b7280',
        count: older.length,
        notes: older,
      });
    }

    // Template-based folders
    const templateGroups: Record<string, VoiceNote[]> = {};
    notes.forEach(note => {
      if (note.templateOutputs) {
        note.templateOutputs.forEach(output => {
          if (!templateGroups[output.templateName]) {
            templateGroups[output.templateName] = [];
          }
          if (!templateGroups[output.templateName].includes(note)) {
            templateGroups[output.templateName].push(note);
          }
        });
      }
    });

    Object.entries(templateGroups).forEach(([templateName, templateNotes]) => {
      folders.push({
        id: `smart-template-${templateName}`,
        name: templateName,
        icon: <PenTool className="w-5 h-5" />,
        color: '#6366f1',
        count: templateNotes.length,
        notes: templateNotes,
      });
    });

    // Patient-based folders
    const patientGroups: Record<string, VoiceNote[]> = {};
    notes.forEach(note => {
      const patientId = extractPatientId(note);
      if (patientId) {
        if (!patientGroups[patientId]) {
          patientGroups[patientId] = [];
        }
        patientGroups[patientId].push(note);
      }
    });

    Object.entries(patientGroups).forEach(([patientId, patientNotes]) => {
      if (patientNotes.length >= 1) { // Show if at least 1 note
        folders.push({
          id: `smart-patient-${patientId}`,
          name: patientId,
          icon: <User className="w-5 h-5" />,
          color: '#f59e0b',
          count: patientNotes.length,
          notes: patientNotes,
        });
      }
    });

    // Notes with summaries
    const withSummary = notes.filter(n => n.parsedSummary);
    if (withSummary.length > 0) {
      folders.push({
        id: 'smart-summaries',
        name: 'With Summary',
        icon: <Sparkles className="w-5 h-5" />,
        color: '#ec4899',
        count: withSummary.length,
        notes: withSummary,
      });
    }

    return folders;
  }, [notes]);

  // Group folders by category
  const dateFilters = smartFolders.filter(f => 
    ['smart-today', 'smart-week', 'smart-month', 'smart-older'].includes(f.id)
  );
  const templateFilters = smartFolders.filter(f => f.id.startsWith('smart-template-'));
  const patientFilters = smartFolders.filter(f => f.id.startsWith('smart-patient-'));
  const otherFilters = smartFolders.filter(f => f.id === 'smart-summaries');

  const FolderRow: React.FC<{ folder: SmartFolder }> = ({ folder }) => (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onFolderSelect(folder)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        selectedFolderId === folder.id
          ? 'bg-indigo-500/20 border border-indigo-500/30'
          : 'hover:bg-terminal-hover'
      }`}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${folder.color}20`, color: folder.color }}
      >
        {folder.icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium text-neutral-100 truncate">{folder.name}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 bg-terminal-surface px-2 py-0.5 rounded">
          {folder.count}
        </span>
        <ChevronRight className="w-4 h-4 text-neutral-500" />
      </div>
    </motion.button>
  );

  if (smartFolders.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Date Filters */}
      {dateFilters.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">
            By Date
          </h3>
          <div className="space-y-1">
            {dateFilters.map(folder => (
              <FolderRow key={folder.id} folder={folder} />
            ))}
          </div>
        </div>
      )}

      {/* Template Filters */}
      {templateFilters.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">
            By Template
          </h3>
          <div className="space-y-1">
            {templateFilters.map(folder => (
              <FolderRow key={folder.id} folder={folder} />
            ))}
          </div>
        </div>
      )}

      {/* Patient Filters */}
      {patientFilters.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">
            By Patient
          </h3>
          <div className="space-y-1">
            {patientFilters.map(folder => (
              <FolderRow key={folder.id} folder={folder} />
            ))}
          </div>
        </div>
      )}

      {/* Other Filters */}
      {otherFilters.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">
            Other
          </h3>
          <div className="space-y-1">
            {otherFilters.map(folder => (
              <FolderRow key={folder.id} folder={folder} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartFolders;
export type { SmartFolder };
