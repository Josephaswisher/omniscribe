import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { transcribeAudio } from '../../services/speechToText';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const config = {
  runtime: 'nodejs',
  maxDuration: 120
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const noteId = params.id;
    const { audioUrl, parserId } = await request.json();

    if (!audioUrl) {
      return Response.json({ error: 'No audio URL provided' }, { status: 400 });
    }

    // Update note status to processing
    await supabase
      .from('notes')
      .update({ status: 'processing' })
      .eq('id', noteId);

    // Fetch audio from storage
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch audio from storage');
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    const mimeType = audioResponse.headers.get('content-type') || 'audio/webm';

    // HYBRID TRANSCRIPTION: Speech-to-Text → Gemini cleanup
    console.log(`[Retry] Processing note ${noteId}, mimeType: ${mimeType}, size: ${audioBuffer.byteLength}`);
    
    let transcript = '';
    
    // Step 1: Use Google Cloud Speech-to-Text
    try {
      console.log('[Retry] Step 1: Google Cloud Speech-to-Text');
      const sttResult = await transcribeAudio(audioBuffer, mimeType);
      transcript = sttResult.transcript;
      console.log(`[Retry] STT complete: ${sttResult.wordCount} words`);
    } catch (sttError: any) {
      console.error('[Retry] STT failed, falling back to Gemini:', sttError?.message);
      
      // Fallback to Gemini-only transcription
      try {
        const base64Audio = Buffer.from(audioBuffer).toString('base64');
        const geminiResponse = await genai.models.generateContent({
          model: 'gemini-3-flash',
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Audio } },
              { text: "Generate a verbatim transcript of this audio. Output only the transcript text, no timestamps, no speaker labels, no commentary. If the audio is unclear or silent, output 'No speech detected.'" }
            ],
          },
        });
        transcript = geminiResponse.text || '';
        console.log('[Retry] Gemini fallback complete');
      } catch (fallbackError: any) {
        console.error('[Retry] Both STT and Gemini failed');
        await supabase
          .from('notes')
          .update({ status: 'error', error_message: `Transcription failed: ${sttError?.message || sttError}` })
          .eq('id', noteId);
        return Response.json({ error: 'Transcription failed', details: sttError?.message }, { status: 500 });
      }
    }

    // Step 2: Use Gemini to clean up the transcript
    if (transcript && transcript !== 'No speech detected.' && transcript.length > 20) {
      try {
        console.log('[Retry] Step 2: Gemini cleanup');
        const cleanupResponse = await genai.models.generateContent({
          model: 'gemini-3-flash',
          contents: `Clean up this speech-to-text transcript. Fix obvious errors, improve punctuation, and make it more readable while preserving the original meaning. Do not add or remove content. Output only the cleaned transcript:\n\n${transcript}`,
        });
        const cleanedTranscript = cleanupResponse.text?.trim();
        if (cleanedTranscript && cleanedTranscript.length > 10) {
          transcript = cleanedTranscript;
        }
      } catch (cleanupError) {
        console.warn('[Retry] Cleanup failed, using raw STT transcript');
      }
    }
    
    console.log(`Transcript length: ${transcript.length}`);

    // Generate title
    let title: string | null = null;
    if (transcript && transcript.length > 10 && transcript !== 'No speech detected.') {
      try {
        const titleResponse = await genai.models.generateContent({
          model: 'gemini-3-flash',
          contents: `Generate a concise descriptive title (3-6 words maximum) for this voice note. Output ONLY the title text, no quotes, no punctuation at the end:\n\n${transcript.substring(0, 500)}`,
        });
        title = titleResponse.text?.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '') || null;
      } catch {
        title = transcript.split(/\s+/).slice(0, 5).join(' ') + '...';
      }
    }

    // Parse with Gemini (if not raw)
    let parsedSummary: string | null = null;
    
    if (parserId && parserId !== 'raw' && transcript) {
      const { data: parser } = await supabase
        .from('parsers')
        .select('system_prompt')
        .eq('id', parserId)
        .single();

      if (parser?.system_prompt) {
        try {
          const parsingResponse = await genai.models.generateContent({
            model: 'gemini-3-flash',
            contents: `${parser.system_prompt}\n\nTranscript:\n${transcript}`,
          });
          parsedSummary = parsingResponse.text || null;
        } catch (parseError) {
          console.error('Parsing error:', parseError);
        }
      }
    }

    // Update note
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        transcript,
        title,
        parsed_summary: parsedSummary,
        status: 'completed',
        word_count: transcript ? transcript.split(/\s+/).length : 0
      })
      .eq('id', noteId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return Response.json({ error: 'Failed to update note' }, { status: 500 });
    }

    return Response.json({ note: updatedNote });
  } catch (error) {
    console.error('POST /api/notes/[id]/retry error:', error);
    return Response.json({ error: 'Failed to retry note' }, { status: 500 });
  }
}
