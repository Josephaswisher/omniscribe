import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, FileDown, Copy, Check, Share2 } from 'lucide-react';
import { VoiceNote, Parser } from '../types';
import { format } from 'date-fns';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: VoiceNote;
  parser?: Parser;
}

type ExportFormat = 'markdown' | 'text' | 'pdf';

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, note, parser }) => {
  const [copied, setCopied] = useState(false);

  const generateMarkdown = (): string => {
    const lines: string[] = [];
    
    // Title
    lines.push(`# ${note.title || 'Untitled Note'}`);
    lines.push('');
    
    // Metadata
    lines.push(`**Date:** ${format(note.createdAt, 'MMMM d, yyyy h:mm a')}`);
    lines.push(`**Duration:** ${formatDuration(note.duration)}`);
    if (note.wordCount) {
      lines.push(`**Words:** ${note.wordCount}`);
    }
    if (parser) {
      lines.push(`**Parser:** ${parser.name}`);
    }
    lines.push('');
    
    // Transcript
    if (note.transcript) {
      lines.push('## Transcript');
      lines.push('');
      lines.push(note.transcript);
      lines.push('');
    }
    
    // Parsed Summary
    if (note.parsedSummary) {
      lines.push(`## ${parser?.name || 'Summary'}`);
      lines.push('');
      lines.push(note.parsedSummary);
      lines.push('');
    }
    
    // Actions
    if (note.actions && note.actions.length > 0) {
      lines.push('## Actions');
      lines.push('');
      note.actions.forEach(action => {
        const checkbox = action.status === 'completed' ? '[x]' : '[ ]';
        lines.push(`- ${checkbox} ${action.content}`);
      });
      lines.push('');
    }
    
    // Footer
    lines.push('---');
    lines.push('*Exported from OmniScribe*');
    
    return lines.join('\n');
  };

  const generatePlainText = (): string => {
    const lines: string[] = [];
    
    lines.push(note.title || 'Untitled Note');
    lines.push('='.repeat(40));
    lines.push('');
    lines.push(`Date: ${format(note.createdAt, 'MMMM d, yyyy h:mm a')}`);
    lines.push(`Duration: ${formatDuration(note.duration)}`);
    lines.push('');
    
    if (note.transcript) {
      lines.push('TRANSCRIPT:');
      lines.push('-'.repeat(20));
      lines.push(note.transcript);
      lines.push('');
    }
    
    if (note.parsedSummary) {
      lines.push(`${(parser?.name || 'SUMMARY').toUpperCase()}:`);
      lines.push('-'.repeat(20));
      lines.push(note.parsedSummary);
      lines.push('');
    }
    
    return lines.join('\n');
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExport = async (format: ExportFormat) => {
    if (format === 'markdown') {
      const content = generateMarkdown();
      downloadFile(content, `${note.title || 'note'}.md`, 'text/markdown');
    } else if (format === 'text') {
      const content = generatePlainText();
      downloadFile(content, `${note.title || 'note'}.txt`, 'text/plain');
    } else if (format === 'pdf') {
      printAsPdf();
    }
    onClose();
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printAsPdf = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${note.title || 'Note'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
          h2 { color: #4a4a4a; margin-top: 30px; }
          .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
          .transcript { background: #f5f5f5; padding: 20px; border-radius: 8px; line-height: 1.6; }
          .summary { line-height: 1.6; }
          .actions { list-style: none; padding: 0; }
          .actions li { padding: 8px 0; border-bottom: 1px solid #eee; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${note.title || 'Untitled Note'}</h1>
        <div class="meta">
          ${format(note.createdAt, 'MMMM d, yyyy h:mm a')} · ${formatDuration(note.duration)}${note.wordCount ? ` · ${note.wordCount} words` : ''}
        </div>
        ${note.transcript ? `<h2>Transcript</h2><div class="transcript">${note.transcript}</div>` : ''}
        ${note.parsedSummary ? `<h2>${parser?.name || 'Summary'}</h2><div class="summary">${note.parsedSummary.replace(/\n/g, '<br>')}</div>` : ''}
        <div class="footer">Exported from OmniScribe</div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleCopyToClipboard = async () => {
    const content = generateMarkdown();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title || 'Voice Note',
          text: generatePlainText(),
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      handleCopyToClipboard();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
          className="w-full max-w-lg bg-slate-900 rounded-t-2xl border-t border-slate-700 safe-bottom"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white">Export Note</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Export Options */}
          <div className="p-6 space-y-3">
            <button
              onClick={() => handleExport('markdown')}
              className="w-full flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium">Markdown</span>
                <p className="text-xs text-slate-500">For Obsidian, Notion, etc.</p>
              </div>
            </button>

            <button
              onClick={() => handleExport('text')}
              className="w-full flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileDown className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium">Plain Text</span>
                <p className="text-xs text-slate-500">Simple .txt file</p>
              </div>
            </button>

            <button
              onClick={() => handleExport('pdf')}
              className="w-full flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <FileDown className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-left">
                <span className="text-white font-medium">PDF</span>
                <p className="text-xs text-slate-500">Print-friendly format</p>
              </div>
            </button>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCopyToClipboard}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm text-slate-300">{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <Share2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Share</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExportModal;
