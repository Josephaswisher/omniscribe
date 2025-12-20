import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { transcribeAudio } from '../services/speechToText';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const config = {
  runtime: 'nodejs',
  maxDuration: 120 // Increased for Speech-to-Text + Gemini pipeline
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

    // 3. HYBRID TRANSCRIPTION: Speech-to-Text → Gemini cleanup
    const mimeType = audioFile.type || 'audio/webm';
    console.log(`Processing audio: ${fileName}, size: ${audioBuffer.byteLength}, mimeType: ${mimeType}`);
    
    let transcript = '';
    let confidence = 0;
    
    // Step 3a: Use Google Cloud Speech-to-Text for raw transcription
    try {
      console.log('[Hybrid] Step 1: Google Cloud Speech-to-Text');
      const sttResult = await transcribeAudio(audioBuffer, mimeType);
      transcript = sttResult.transcript;
      confidence = sttResult.confidence;
      console.log(`[Hybrid] STT complete: ${sttResult.wordCount} words, confidence: ${confidence.toFixed(2)}`);
    } catch (sttError: any) {
      console.error('[Hybrid] STT failed, falling back to Gemini:', sttError?.message);
      
      // Fallback to Gemini-only transcription if STT fails
      try {
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
        console.log('[Hybrid] Gemini fallback transcription complete');
      } catch (fallbackError: any) {
        console.error('[Hybrid] Both STT and Gemini failed:', fallbackError?.message);
        await supabase
          .from('notes')
          .update({ status: 'error', error_message: `Transcription failed: ${sttError?.message || sttError}` })
          .eq('id', noteId);
        return Response.json({ error: 'Transcription failed', details: sttError?.message }, { status: 500 });
      }
    }

    // Step 3b: Use Gemini to clean up the transcript (optional enhancement)
    if (transcript && transcript !== 'No speech detected.' && transcript.length > 20) {
      try {
        console.log('[Hybrid] Step 2: Gemini cleanup');
        const cleanupResponse = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Clean up this speech-to-text transcript. Fix obvious errors, improve punctuation, and make it more readable while preserving the original meaning. Do not add or remove content. Output only the cleaned transcript:\n\n${transcript}`,
        });
        const cleanedTranscript = cleanupResponse.text?.trim();
        if (cleanedTranscript && cleanedTranscript.length > 10) {
          transcript = cleanedTranscript;
          console.log('[Hybrid] Cleanup complete');
        }
      } catch (cleanupError) {
        console.warn('[Hybrid] Cleanup failed, using raw STT transcript');
      }
    }
    
    console.log(`Transcript length: ${transcript.length}`);

    // 4. Generate title from transcript
    let title: string | null = null;
    if (transcript && transcript.length > 10 && transcript !== 'No speech detected.') {
      try {
        const titleResponse = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Generate a concise descriptive title (3-6 words maximum) for this voice note. Output ONLY the title text, no quotes, no punctuation at the end:\n\n${transcript.substring(0, 500)}`,
        });
        title = titleResponse.text?.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '') || null;
        console.log(`Generated title: ${title}`);
      } catch (titleError) {
        console.error('Title generation error:', titleError);
        title = transcript.split(/\s+/).slice(0, 5).join(' ') + '...';
      }
    }

    // 5. Parse with Gemini (if not raw)
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
            model: 'gemini-2.5-flash',
            contents: `${parser.system_prompt}\n\nTranscript:\n${transcript}`,
          });
          parsedSummary = parsingResponse.text || null;
          console.log('Parsing successful');
        } catch (parseError) {
          console.error('Parsing error:', parseError);
        }
      }
    }

    // 6. Update note with transcript, title, and summary
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
