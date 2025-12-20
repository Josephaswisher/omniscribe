
import { GoogleGenAI } from "@google/genai";
import { Parser } from './types';

export const transcribeAndParse = async (
  audioBlob: Blob,
  parser?: Parser
): Promise<{ transcript: string; summary?: string }> => {
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
  // Fix: Refactor contents to use recommended single object with parts for multimodal inputs
  const transcriptionResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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

  // Step 2: Parsing (if applicable)
  let summary: string | undefined = undefined;
  if (parser && parser.id !== 'raw') {
    const parsingResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: transcript,
      config: {
        systemInstruction: parser.systemPrompt,
      },
    });
    summary = parsingResponse.text;
  }

  return { transcript, summary };
};
