import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
// Temporarily disabled Speech-to-Text - using Gemini-only
// import { transcribeAudio } from '../services/speechToText';

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

    // 3. TRANSCRIPTION: Using Gemini for audio transcription with word-level timestamps
    const mimeType = audioFile.type || 'audio/webm';
    console.log(`Processing audio: ${fileName}, size: ${audioBuffer.byteLength}, mimeType: ${mimeType}`);

    let transcript = '';
    let segments: Array<{ start_ms: number; end_ms: number; text: string; confidence?: number }> = [];
    let detectedLanguage: string | null = null;
    let languageCode: string | null = null;

    try {
      console.log('[Transcription] Using Gemini for transcription with segments and language detection');
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      // Request structured transcription with timestamps and language detection
      const geminiResponse = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            { text: `Transcribe this audio with word-level timestamps. Detect the spoken language. Return JSON in this exact format:
{
  "transcript": "full transcript text here",
  "language": "English",
  "languageCode": "en",
  "segments": [
    {"start_ms": 0, "end_ms": 500, "text": "word or phrase", "confidence": 0.95},
    {"start_ms": 500, "end_ms": 1000, "text": "next words", "confidence": 0.92}
  ]
}

Rules:
- Detect the primary spoken language and return both full name and ISO 639-1 code
- Common codes: en (English), es (Spanish), fr (French), de (German), zh (Chinese), ja (Japanese), ko (Korean), pt (Portuguese), ar (Arabic), hi (Hindi), ru (Russian), it (Italian)
- Segment by natural phrases (2-5 words each)
- Times in milliseconds from audio start
- Confidence 0.0-1.0 (estimate based on audio clarity)
- If silent/unclear: {"transcript": "No speech detected.", "language": "Unknown", "languageCode": "und", "segments": []}
- Output ONLY valid JSON, no markdown, no code fences` }
          ],
        },
      });

      const responseText = geminiResponse.text || '';

      // Parse the JSON response
      try {
        // Clean any markdown code fences if present
        const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        transcript = parsed.transcript || '';
        segments = parsed.segments || [];
        detectedLanguage = parsed.language || null;
        languageCode = parsed.languageCode || null;
        console.log(`[Transcription] Parsed ${segments.length} segments, language: ${detectedLanguage} (${languageCode})`);
      } catch (parseError) {
        // Fallback: use response as plain transcript
        console.warn('[Transcription] JSON parse failed, using plain text');
        transcript = responseText.replace(/```json\n?|\n?```/g, '').trim();
        // Try to extract just the transcript if it's a malformed JSON
        const transcriptMatch = transcript.match(/"transcript"\s*:\s*"([^"]+)"/);
        if (transcriptMatch) {
          transcript = transcriptMatch[1];
        }
        // Try to extract language from malformed JSON
        const languageMatch = responseText.match(/"language"\s*:\s*"([^"]+)"/);
        if (languageMatch) {
          detectedLanguage = languageMatch[1];
        }
        const codeMatch = responseText.match(/"languageCode"\s*:\s*"([^"]+)"/);
        if (codeMatch) {
          languageCode = codeMatch[1];
        }
      }

      console.log(`[Transcription] Complete, length: ${transcript.length}`);
    } catch (transcribeError: any) {
      console.error('[Transcription] Failed:', transcribeError?.message);
      await supabase
        .from('notes')
        .update({ status: 'error', error_message: `Transcription failed: ${transcribeError?.message || transcribeError}` })
        .eq('id', noteId);
      return Response.json({ error: 'Transcription failed', details: transcribeError?.message }, { status: 500 });
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

    // 6. Update note with transcript, title, summary, and language
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        transcript,
        title,
        parsed_summary: parsedSummary,
        status: 'completed',
        word_count: transcript ? transcript.split(/\s+/).length : 0,
        detected_language: detectedLanguage,
        language_code: languageCode
      })
      .eq('id', noteId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return Response.json({ error: 'Failed to update note' }, { status: 500 });
    }

    // 7. Store transcript segments for audio sync playback
    if (segments.length > 0) {
      try {
        console.log(`[Segments] Storing ${segments.length} segments for note:`, noteId);

        // Clear any existing segments for this note (in case of re-processing)
        await supabase.from('note_segments').delete().eq('note_id', noteId);

        // Insert new segments
        const segmentRows = segments.map((seg) => ({
          note_id: noteId,
          start_ms: seg.start_ms,
          end_ms: seg.end_ms,
          text: seg.text,
          speaker_label: 'Speaker 1', // Default, diarization will update later
          confidence: seg.confidence ?? null
        }));

        const { error: segmentError } = await supabase
          .from('note_segments')
          .insert(segmentRows);

        if (segmentError) {
          console.error('[Segments] Insert error:', segmentError);
        } else {
          console.log(`[Segments] Stored ${segmentRows.length} segments`);
        }
      } catch (segmentErr) {
        console.error('[Segments] Failed:', segmentErr);
        // Don't fail the request, segments are optional
      }
    }

    // 8. Generate embedding for semantic search (async, non-blocking)
    if (transcript && transcript.length > 20 && transcript !== 'No speech detected.') {
      try {
        console.log('[Embedding] Generating embedding for note:', noteId);
        const embeddingResponse = await genai.models.embedContent({
          model: 'text-embedding-004',
          contents: transcript,
        });
        const embedding = embeddingResponse.embeddings?.[0]?.values;
        
        if (embedding && embedding.length > 0) {
          await supabase
            .from('notes')
            .update({ embedding: `[${embedding.join(',')}]` })
            .eq('id', noteId);
          console.log('[Embedding] Stored embedding, dimension:', embedding.length);
        }
      } catch (embedError) {
        console.error('[Embedding] Failed:', embedError);
        // Don't fail the request, embedding is optional
      }
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
