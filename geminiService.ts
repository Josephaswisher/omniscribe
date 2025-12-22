import { GoogleGenAI } from "@google/genai";
import { Parser, TranscriptSegment } from "./types";

// Segment type for local transcription (without database fields)
export interface LocalTranscriptSegment {
  start_ms: number;
  end_ms: number;
  text: string;
  confidence?: number;
  speaker_label?: string;
}

// Check if local Gemini API is available
export const isLocalTranscriptionAvailable = (): boolean => {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
};

export const transcribeAndParse = async (
  audioBlob: Blob,
  parser?: Parser,
): Promise<{
  transcript: string;
  summary?: string;
  title?: string;
  segments?: LocalTranscriptSegment[];
  detectedLanguage?: string;
  languageCode?: string;
}> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key not configured for local mode. " +
        "Either set VITE_GEMINI_API_KEY in your .env.local file, " +
        "or enable cloud sync with Supabase credentials.",
    );
  }
  const ai = new GoogleGenAI({ apiKey });

  // Convert Blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve) => {
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.readAsDataURL(audioBlob);
  });

  const base64Audio = await base64Promise;

  // Step 1: Transcription with word-level timestamps, language detection, and speaker diarization
  let transcript = "";
  let segments: LocalTranscriptSegment[] = [];
  let detectedLanguage: string | undefined;
  let languageCode: string | undefined;

  const transcriptionResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: audioBlob.type || "audio/mp4",
            data: base64Audio,
          },
        },
        {
          text: `Transcribe this audio with word-level timestamps and speaker diarization. Detect the spoken language and identify different speakers. Return JSON in this exact format:
{
  "transcript": "full transcript text here",
  "language": "English",
  "languageCode": "en",
  "speakerCount": 2,
  "segments": [
    {"start_ms": 0, "end_ms": 500, "text": "word or phrase", "confidence": 0.95, "speaker_label": "Speaker 1"},
    {"start_ms": 500, "end_ms": 1000, "text": "next words", "confidence": 0.92, "speaker_label": "Speaker 2"}
  ]
}

Rules:
- Detect the primary spoken language and return both full name and ISO 639-1 code
- Common codes: en (English), es (Spanish), fr (French), de (German), zh (Chinese), ja (Japanese), ko (Korean), pt (Portuguese), ar (Arabic), hi (Hindi), ru (Russian), it (Italian)
- Identify different speakers by voice characteristics (pitch, tone, accent)
- Label speakers as "Speaker 1", "Speaker 2", etc. or use contextual names if mentioned (e.g., "Doctor", "Patient")
- For medical conversations, try to identify "Doctor" vs "Patient" roles
- Segment by natural phrases (2-5 words each)
- Times in milliseconds from audio start
- Confidence 0.0-1.0 (estimate based on audio clarity)
- If single speaker, use "Speaker 1" for all segments
- If silent/unclear: {"transcript": "No speech detected.", "language": "Unknown", "languageCode": "und", "speakerCount": 0, "segments": []}
- Output ONLY valid JSON, no markdown, no code fences`,
        },
      ],
    },
  });

  const responseText = transcriptionResponse.text || "";

  // Parse JSON response with fallback to plain text
  try {
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    transcript = parsed.transcript || "";
    segments = parsed.segments || [];
    detectedLanguage = parsed.language;
    languageCode = parsed.languageCode;
  } catch {
    // Fallback: use response as plain transcript
    transcript = responseText.replace(/```json\n?|\n?```/g, "").trim();
    // Try to extract transcript from malformed JSON
    const transcriptMatch = transcript.match(/"transcript"\s*:\s*"([^"]+)"/);
    if (transcriptMatch) {
      transcript = transcriptMatch[1];
    }
    // Try to extract language from malformed JSON
    const languageMatch = transcript.match(/"language"\s*:\s*"([^"]+)"/);
    if (languageMatch) {
      detectedLanguage = languageMatch[1];
    }
    const codeMatch = transcript.match(/"languageCode"\s*:\s*"([^"]+)"/);
    if (codeMatch) {
      languageCode = codeMatch[1];
    }
  }

  if (!transcript) {
    transcript = "Transcription failed.";
  }

  // Step 2: Generate title from transcript
  let title: string | undefined = undefined;
  if (transcript && transcript.length > 10) {
    try {
      const titleResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate a short title (3-6 words) for this transcript. Output ONLY the title, nothing else:\n\n${transcript.substring(0, 500)}`,
      });
      title = titleResponse.text
        ?.trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\.$/, "");
    } catch {
      // Fall back to first few words
      title = transcript.split(/\s+/).slice(0, 5).join(" ") + "...";
    }
  }

  // Step 3: Parsing (if applicable)
  let summary: string | undefined = undefined;
  if (parser && parser.id !== "raw") {
    const parsingResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${parser.systemPrompt}\n\nTranscript:\n${transcript}`,
    });
    summary = parsingResponse.text;
  }

  return {
    transcript,
    summary,
    title,
    segments,
    detectedLanguage,
    languageCode,
  };
};

export const applyTemplateToTranscript = async (
  transcript: string,
  systemPrompt: string,
): Promise<string> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `${systemPrompt}\n\nTranscript:\n${transcript}`,
  });

  return response.text || "";
};

// Medical spell check result
export interface MedicalSpellCheckResult {
  original: string;
  suggestion: string;
  category:
    | "medication"
    | "diagnosis"
    | "procedure"
    | "anatomy"
    | "abbreviation"
    | "general";
  confidence: number;
  context: string;
}

export const checkMedicalSpelling = async (
  text: string,
): Promise<MedicalSpellCheckResult[]> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are a medical spell-checker. Analyze the following medical transcript and identify potential spelling errors, particularly for:
- Medication names (brand and generic)
- Medical diagnoses and conditions
- Procedures and treatments
- Anatomical terms
- Medical abbreviations

Return JSON array of potential errors:
[
  {
    "original": "misspelled word",
    "suggestion": "correct spelling",
    "category": "medication|diagnosis|procedure|anatomy|abbreviation|general",
    "confidence": 0.95,
    "context": "surrounding text for context"
  }
]

If no errors found, return empty array: []
Output ONLY valid JSON, no markdown.

Text to check:
${text}`,
  });

  try {
    const cleanJson = (response.text || "[]")
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    return JSON.parse(cleanJson);
  } catch {
    return [];
  }
};

// Differential diagnosis result
export interface DifferentialItem {
  diagnosis: string;
  likelihood: "high" | "moderate" | "low";
  supportingFindings: string[];
  contradictingFindings: string[];
  suggestedWorkup: string[];
}

export interface DifferentialResult {
  chiefComplaint: string;
  differentials: DifferentialItem[];
  criticalActions: string[];
  redFlags: string[];
}

export const generateDifferential = async (
  transcript: string,
): Promise<DifferentialResult> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You are a clinical decision support assistant. Analyze this medical transcript and generate a differential diagnosis list.

Return JSON in this exact format:
{
  "chiefComplaint": "main presenting symptom/complaint",
  "differentials": [
    {
      "diagnosis": "Diagnosis name",
      "likelihood": "high|moderate|low",
      "supportingFindings": ["finding 1", "finding 2"],
      "contradictingFindings": ["finding that argues against"],
      "suggestedWorkup": ["test 1", "test 2"]
    }
  ],
  "criticalActions": ["urgent action if needed"],
  "redFlags": ["warning signs to watch for"]
}

Rules:
- List 3-7 differential diagnoses, ranked by likelihood
- Include both common and must-not-miss diagnoses
- Be specific with workup recommendations
- Highlight any red flags or urgent findings
- Output ONLY valid JSON, no markdown

Medical Transcript:
${transcript}`,
  });

  try {
    const cleanJson = (response.text || "{}")
      .replace(/```json\n?|\n?```/g, "")
      .trim();
    return JSON.parse(cleanJson);
  } catch {
    return {
      chiefComplaint: "Unable to parse transcript",
      differentials: [],
      criticalActions: [],
      redFlags: [],
    };
  }
};

// Real-time preview (streaming)
export const streamTemplatePreview = async (
  transcript: string,
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<void> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: `${systemPrompt}\n\nTranscript:\n${transcript}`,
  });

  for await (const chunk of response) {
    if (chunk.text) {
      onChunk(chunk.text);
    }
  }
};
