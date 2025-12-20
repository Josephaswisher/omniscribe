import { SpeechClient } from '@google-cloud/speech';

// Initialize client with credentials from environment
const getClient = () => {
  const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
  if (credentials) {
    return new SpeechClient({
      credentials: JSON.parse(credentials)
    });
  }
  // Fallback to ADC (Application Default Credentials)
  return new SpeechClient();
};

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  wordCount: number;
}

// Map browser MIME types to Speech-to-Text encoding
function getEncoding(mimeType: string): 'WEBM_OPUS' | 'OGG_OPUS' | 'MP3' | 'LINEAR16' | 'FLAC' {
  const map: Record<string, 'WEBM_OPUS' | 'OGG_OPUS' | 'MP3' | 'LINEAR16' | 'FLAC'> = {
    'audio/webm': 'WEBM_OPUS',
    'audio/webm;codecs=opus': 'WEBM_OPUS',
    'audio/ogg': 'OGG_OPUS',
    'audio/ogg;codecs=opus': 'OGG_OPUS',
    'audio/mpeg': 'MP3',
    'audio/mp3': 'MP3',
    'audio/wav': 'LINEAR16',
    'audio/flac': 'FLAC',
  };
  // Default to WEBM_OPUS as that's what MediaRecorder typically produces
  return map[mimeType] || 'WEBM_OPUS';
}

export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  mimeType: string
): Promise<TranscriptionResult> {
  const client = getClient();
  const audioBytes = Buffer.from(audioBuffer).toString('base64');
  const encoding = getEncoding(mimeType);

  console.log(`[Speech-to-Text] Starting transcription, mimeType: ${mimeType}, encoding: ${encoding}, size: ${audioBuffer.byteLength}`);

  try {
    const [response] = await client.recognize({
      config: {
        encoding,
        sampleRateHertz: 48000, // WebM/Opus typically uses 48kHz
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'latest_long', // Best for longer recordings
        useEnhanced: true, // Use enhanced model for better accuracy
        // Alternative models: 'phone_call', 'video', 'default', 'latest_short'
      },
      audio: {
        content: audioBytes,
      },
    });

    const transcription = response.results
      ?.map(result => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim() || '';

    const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0;
    const wordCount = transcription ? transcription.split(/\s+/).length : 0;

    console.log(`[Speech-to-Text] Transcription complete, words: ${wordCount}, confidence: ${confidence.toFixed(2)}`);

    return {
      transcript: transcription || 'No speech detected.',
      confidence,
      wordCount
    };
  } catch (error: any) {
    console.error('[Speech-to-Text] Error:', error.message || error);
    
    // Handle specific errors
    if (error.code === 3) { // INVALID_ARGUMENT
      throw new Error(`Audio format not supported: ${mimeType}. Try recording in a different format.`);
    }
    if (error.code === 11) { // OUT_OF_RANGE - audio too long for sync
      // Fall back to async recognition for long audio
      return transcribeLongAudio(audioBuffer, mimeType);
    }
    
    throw error;
  }
}

// For audio longer than ~1 minute, use async recognition
async function transcribeLongAudio(
  audioBuffer: ArrayBuffer,
  mimeType: string
): Promise<TranscriptionResult> {
  const client = getClient();
  const audioBytes = Buffer.from(audioBuffer).toString('base64');
  const encoding = getEncoding(mimeType);

  console.log(`[Speech-to-Text] Using long audio recognition for ${audioBuffer.byteLength} bytes`);

  const [operation] = await client.longRunningRecognize({
    config: {
      encoding,
      sampleRateHertz: 48000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      model: 'latest_long',
      useEnhanced: true,
    },
    audio: {
      content: audioBytes,
    },
  });

  // Wait for the operation to complete
  const [response] = await operation.promise();

  const transcription = response.results
    ?.map(result => result.alternatives?.[0]?.transcript || '')
    .join(' ')
    .trim() || '';

  const confidence = response.results?.[0]?.alternatives?.[0]?.confidence || 0;
  const wordCount = transcription ? transcription.split(/\s+/).length : 0;

  console.log(`[Speech-to-Text] Long transcription complete, words: ${wordCount}`);

  return {
    transcript: transcription || 'No speech detected.',
    confidence,
    wordCount
  };
}
