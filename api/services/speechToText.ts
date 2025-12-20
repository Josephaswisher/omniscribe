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
type AudioEncoding = 'WEBM_OPUS' | 'OGG_OPUS' | 'MP3' | 'LINEAR16' | 'FLAC' | 'ENCODING_UNSPECIFIED';

function getEncoding(mimeType: string): AudioEncoding {
  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
  const map: Record<string, AudioEncoding> = {
    'audio/webm': 'WEBM_OPUS',
    'audio/ogg': 'OGG_OPUS',
    'audio/mpeg': 'MP3',
    'audio/mp3': 'MP3',
    'audio/wav': 'LINEAR16',
    'audio/wave': 'LINEAR16',
    'audio/x-wav': 'LINEAR16',
    'audio/flac': 'FLAC',
    'audio/x-flac': 'FLAC',
    // MP4/M4A - let Speech-to-Text auto-detect (common on iOS)
    'audio/mp4': 'ENCODING_UNSPECIFIED',
    'audio/m4a': 'ENCODING_UNSPECIFIED',
    'audio/x-m4a': 'ENCODING_UNSPECIFIED',
    'audio/aac': 'ENCODING_UNSPECIFIED',
  };
  // Default to ENCODING_UNSPECIFIED to let the API auto-detect
  return map[normalizedMime] || 'WEBM_OPUS';
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
    // Build config - only include encoding if not ENCODING_UNSPECIFIED
    const config: any = {
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      model: 'latest_long',
      useEnhanced: true,
    };
    
    if (encoding !== 'ENCODING_UNSPECIFIED') {
      config.encoding = encoding;
      config.sampleRateHertz = 48000; // WebM/Opus typically uses 48kHz
    }
    // For MP4/AAC, let the API auto-detect sample rate and encoding

    const [response] = await client.recognize({
      config,
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

  const config: any = {
    languageCode: 'en-US',
    enableAutomaticPunctuation: true,
    model: 'latest_long',
    useEnhanced: true,
  };
  
  if (encoding !== 'ENCODING_UNSPECIFIED') {
    config.encoding = encoding;
    config.sampleRateHertz = 48000;
  }

  const [operation] = await client.longRunningRecognize({
    config,
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
