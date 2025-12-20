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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ notes: data });
  } catch (error) {
    console.error('GET /api/notes error:', error);
    return Response.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const parserId = formData.get('parserId') as string || 'raw';
    const noteId = formData.get('noteId') as string || crypto.randomUUID();
    const duration = parseFloat(formData.get('duration') as string || '0');
    const createdAt = formData.get('createdAt') as string || new Date().toISOString();

    if (!audioFile) {
      return Response.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // 1. Upload audio to Supabase Storage
    const audioBuffer = await audioFile.arrayBuffer();
    const ext = getExtension(audioFile.type);
    const fileName = `${noteId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBuffer, {
        contentType: audioFile.type,
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return Response.json({ error: 'Failed to upload audio' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);
    const audioUrl = urlData.publicUrl;

    // 2. Create initial note record
    const { error: insertError } = await supabase
      .from('notes')
      .upsert({
        id: noteId,
        created_at: createdAt,
        duration,
        audio_url: audioUrl,
        parser_id: parserId,
        status: 'processing'
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return Response.json({ error: 'Failed to create note' }, { status: 500 });
    }

    // 3. Transcribe with Gemini
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    let transcriptionResponse;
    try {
      transcriptionResponse = await genai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: audioFile.type || 'audio/mp4',
                data: base64Audio,
              },
            },
            { text: "Please transcribe this audio exactly as it is spoken. Do not add filler or commentary. Output ONLY the raw transcript text." }
          ],
        },
      });
    } catch (transcribeError) {
      console.error('Transcription error:', transcribeError);
      // Update note with error status
      await supabase
        .from('notes')
        .update({ status: 'error', error_message: 'Transcription failed' })
        .eq('id', noteId);
      return Response.json({ error: 'Transcription failed', details: String(transcribeError) }, { status: 500 });
    }

    const transcript = transcriptionResponse.text || '';

    // 4. Parse with Gemini (if not raw)
    let parsedSummary: string | null = null;
    
    if (parserId !== 'raw' && transcript) {
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
          // Continue without parsed summary
        }
      }
    }

    // 5. Update note with transcript and summary
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        transcript,
        parsed_summary: parsedSummary,
        status: 'completed'
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
    console.error('POST /api/notes error:', error);
    return Response.json({ error: 'Failed to process note' }, { status: 500 });
  }
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'audio/mp4': 'mp4',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3'
  };
  return map[mimeType] || 'mp4';
}
