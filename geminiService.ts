
import { GoogleGenAI } from "@google/genai";
import { Parser } from './types';

export const transcribeAndParse = async (
  audioBlob: Blob,
  parser?: Parser
): Promise<{ transcript: string; summary?: string; title?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    model: 'gemini-2.0-flash-exp',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: audioBlob.type || 'audio/mp4',
            data: base64Audio,
          },
        },
        { text: "Please transcribe this audio exactly as it is spoken. Do not add filler or commentary. Output ONLY the raw transcript text." }
      ],
    },
  });

  const transcript = transcriptionResponse.text || "Transcription failed.";

  // Step 2: Generate title from transcript
  let title: string | undefined = undefined;
  if (transcript && transcript.length > 10) {
    try {
      const titleResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: transcript,
        config: {
          systemInstruction: `Generate a short, descriptive title (3-6 words max) for this voice note transcript. 
The title should capture the main topic or theme.
Output ONLY the title text, no quotes, no punctuation at the end, no explanation.`,
        },
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
      model: 'gemini-2.0-flash-exp',
      contents: transcript,
      config: {
        systemInstruction: parser.systemPrompt,
      },
    });
    summary = parsingResponse.text;
  }

  return { transcript, summary, title };
};
