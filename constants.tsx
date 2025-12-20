
import { Parser } from './types';

export const DEFAULT_PARSERS: Parser[] = [
  {
    id: 'raw',
    name: 'Raw',
    description: 'No processing, just transcription.',
    systemPrompt: '',
    isDefault: true
  },
  {
    id: 'diary',
    name: 'Journal',
    description: 'Converts rambling thoughts into a neat diary entry.',
    systemPrompt: 'You are an introspective journal editor. Take the following transcript and turn it into a beautifully written first-person journal entry. Correct grammar and flow while keeping the original sentiment.',
    isDefault: true
  },
  {
    id: 'todo',
    name: 'To-Do',
    description: 'Extracts actionable tasks.',
    systemPrompt: 'You are a task extractor. List all actionable tasks or to-do items from the transcript as a clean bulleted list. If no tasks are found, say "No tasks found."',
    isDefault: true
  },
  {
    id: 'meeting',
    name: 'Minutes',
    description: 'Summarizes meetings.',
    systemPrompt: 'You are a professional scribe. Summarize the transcript into meeting minutes with sections for: Key Discussion Points, Decisions Made, and Action Items.',
    isDefault: true
  }
];
