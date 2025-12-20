import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
// Temporarily disabled Speech-to-Text - using Gemini-only
// import { transcribeAudio } from '../../services/speechToText';

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

    // TRANSCRIPTION: Using Gemini for audio transcription
    console.log(`[Retry] Processing note ${noteId}, mimeType: ${mimeType}, size: ${audioBuffer.byteLength}`);
    
    let transcript = '';
    
    try {
      console.log('[Retry] Using Gemini for transcription');
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      const geminiResponse = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            { text: "Generate a verbatim transcript of this audio. Output only the transcript text, no timestamps, no speaker labels, no commentary. If the audio is unclear or silent, output 'No speech detected.'" }
          ],
        },
      });
      transcript = geminiResponse.text || '';
      console.log(`[Retry] Transcription complete, length: ${transcript.length}`);
    } catch (transcribeError: any) {
      console.error('[Retry] Transcription failed:', transcribeError?.message);
      await supabase
        .from('notes')
        .update({ status: 'error', error_message: `Transcription failed: ${transcribeError?.message || transcribeError}` })
        .eq('id', noteId);
      return Response.json({ error: 'Transcription failed', details: transcribeError?.message }, { status: 500 });
    }
    
    console.log(`Transcript length: ${transcript.length}`);

    // Generate title
    let title: string | null = null;
    if (transcript && transcript.length > 10 && transcript !== 'No speech detected.') {
      try {
        const titleResponse = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
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
            model: 'gemini-2.5-flash',
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
