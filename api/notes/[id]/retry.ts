import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const config = {
  runtime: 'nodejs',
  maxDuration: 60
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
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const mimeType = audioResponse.headers.get('content-type') || 'audio/mp4';

    // Transcribe with Gemini
    let transcriptionResponse;
    try {
      transcriptionResponse = await genai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Audio,
              },
            },
            { text: "Please transcribe this audio exactly as it is spoken. Do not add filler or commentary. Output ONLY the raw transcript text." }
          ],
        },
      });
    } catch (transcribeError) {
      console.error('Transcription error:', transcribeError);
      await supabase
        .from('notes')
        .update({ status: 'error', error_message: 'Transcription failed' })
        .eq('id', noteId);
      return Response.json({ error: 'Transcription failed', details: String(transcribeError) }, { status: 500 });
    }

    const transcript = transcriptionResponse.text || '';

    // Generate title
    let title: string | null = null;
    if (transcript && transcript.length > 10) {
      try {
        const titleResponse = await genai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: transcript,
          config: {
            systemInstruction: `Generate a short, descriptive title (3-6 words max) for this voice note transcript. 
The title should capture the main topic or theme.
Output ONLY the title text, no quotes, no punctuation at the end, no explanation.`,
          },
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
            model: 'gemini-2.0-flash-exp',
            contents: transcript,
            config: {
              systemInstruction: parser.system_prompt,
            },
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
