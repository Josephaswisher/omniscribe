
import { GoogleGenAI } from "@google/genai";
import { Parser } from './types';

export const transcribeAndParse = async (
  audioBlob: Blob,
  parser?: Parser
): Promise<{ transcript: string; summary?: string; title?: string }> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set VITE_GEMINI_API_KEY in environment.');
  }
  const ai = new GoogleGenAI({ apiKey });
  
  // Convert Blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve) => {
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.readAsDataURL(audioBlob);
  });
  
  const base64Audio = await base64Promise;

  // Step 1: Transcription
  const transcriptionResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: audioBlob.type || 'audio/mp4',
            data: base64Audio,
          },
        },
        { text: "Please transcribe this audio exactly as spoken. Output ONLY the transcript text, no commentary." }
      ],
    },
  });

  const transcript = transcriptionResponse.text || "Transcription failed.";

  // Step 2: Generate title from transcript
  let title: string | undefined = undefined;
  if (transcript && transcript.length > 10) {
    try {
      const titleResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a short title (3-6 words) for this transcript. Output ONLY the title, nothing else:\n\n${transcript.substring(0, 500)}`,
      });
      title = titleResponse.text?.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
    } catch {
      // Fall back to first few words
      title = transcript.split(/\s+/).slice(0, 5).join(' ') + '...';
    }
  }

  // Step 3: Parsing (if applicable)
  let summary: string | undefined = undefined;
  if (parser && parser.id !== 'raw') {
    const parsingResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${parser.systemPrompt}\n\nTranscript:\n${transcript}`,
    });
    summary = parsingResponse.text;
  }

  return { transcript, summary, title };
};
