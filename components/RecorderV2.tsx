import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Pause, Play, Square, X, Check } from 'lucide-react';
import Waveform from './Waveform';
import { Parser } from '../types';

interface RecorderV2Props {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  parsers: Parser[];
  selectedParserId: string;
  onParserChange: (id: string) => void;
  isFullScreen?: boolean;
  onClose?: () => void;
}

const RecorderV2: React.FC<RecorderV2Props> = ({
  onRecordingComplete,
  parsers,
  selectedParserId,
  onParserChange,
  isFullScreen = false,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false); // Ref to avoid stale closure

  // Sync isPaused state with ref
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Use interval-based waveform updates for more reliable performance
  const startWaveformUpdates = useCallback(() => {
    if (waveformIntervalRef.current) return;
    
    waveformIntervalRef.current = setInterval(() => {
      if (!analyserRef.current || isPausedRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate RMS for better audio level representation
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalized = Math.min(1, rms / 128);
      
      // Add some visual variation
      const boosted = Math.min(1, normalized * 1.5 + 0.1);

      setWaveformData(prev => [...prev.slice(-59), boosted]);
    }, 80); // ~12fps for smooth but efficient updates
  }, []); // No deps - uses refs to avoid stale closures

  const stopWaveformUpdates = useCallback(() => {
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      startWaveformUpdates();
    } else {
      stopWaveformUpdates();
    }
    return stopWaveformUpdates;
  }, [isRecording, isPaused, startWaveformUpdates, stopWaveformUpdates]);

  // Auto-start recording when opened in fullscreen mode
  useEffect(() => {
    if (isFullScreen && !isRecording) {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen]);

  const startRecording = async () => {
    try {
      console.log('[Recorder] Starting recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('[Recorder] Got media stream');

      // Setup audio analysis
      audioContextRef.current = new AudioContext();
      // Resume AudioContext (required on some browsers after user gesture)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[Recorder] AudioContext resumed');
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      console.log('[Recorder] Audio analysis setup complete');

      // Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // Collect data every 100ms for pause support
      console.log('[Recorder] MediaRecorder started');
      
      // Update state
      setIsRecording(true);
      setIsPaused(false);
      isPausedRef.current = false;
      setWaveformData([]);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;

      // Start timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          const totalElapsed = Date.now() - startTimeRef.current - pausedTimeRef.current;
          setElapsed(Math.floor(totalElapsed / 1000));
        }
      }, 100);
      console.log('[Recorder] Timer started');

      if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (err) {
      console.error('[Recorder] Failed to start recording', err);
      alert('Please allow microphone access to record notes.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        // Resume - add the paused duration to total paused time
        pausedTimeRef.current += Date.now() - pauseStartRef.current;
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        // Pause - record when we started pausing
        pauseStartRef.current = Date.now();
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
      if ('vibrate' in navigator) navigator.vibrate(30);
    }
  };

  const stopRecording = (save: boolean = true) => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.stop();
    
    if (timerRef.current) clearInterval(timerRef.current);
    stopWaveformUpdates();

    if (save && chunksRef.current.length > 0) {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/ogg';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onRecordingComplete(blob, elapsed);
    }

    // Cleanup
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();

    setIsRecording(false);
    setIsPaused(false);
    setElapsed(0);
    setWaveformData([]);

    if ('vibrate' in navigator) navigator.vibrate([30, 30]);
    if (onClose) onClose();
  };

  const cancelRecording = () => {
    // Stop any ongoing recording
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    // Cleanup
    if (timerRef.current) clearInterval(timerRef.current);
    stopWaveformUpdates();
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();

    setIsRecording(false);
    setIsPaused(false);
    setElapsed(0);
    setWaveformData([]);

    if (onClose) onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isFullScreen && !isRecording) {
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={startRecording}
        className="w-full py-6 flex flex-col items-center justify-center"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Mic className="w-8 h-8 text-white" />
        </div>
        <p className="mt-4 text-sm text-slate-400 font-medium">Tap to record</p>
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className={`${isFullScreen ? 'fixed inset-0 z-50' : ''} bg-terminal-bg flex flex-col`}
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        
        {/* Header with Parser Selection */}
        <div className="relative safe-top px-6 py-4 border-b border-terminal-border">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={cancelRecording}
              className="w-10 h-10 rounded-lg bg-terminal-surface border border-terminal-border flex items-center justify-center hover:border-terminal-muted transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
            <span className="text-xs font-mono font-semibold text-rgb-red uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-rgb-red rounded-full animate-pulse" />
              REC
            </span>
            <div className="w-10" />
          </div>

          {/* Parser Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {parsers.map(parser => (
              <button
                key={parser.id}
                onClick={() => onParserChange(parser.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all border ${
                  selectedParserId === parser.id
                    ? 'bg-rgb-cyan text-black border-rgb-cyan'
                    : 'bg-terminal-surface text-neutral-400 border-terminal-border hover:border-terminal-muted'
                }`}
              >
                {parser.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main Recording Area */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-6">
          {/* Timer */}
          <motion.div
            animate={{ scale: isPaused ? [1, 0.98, 1] : 1 }}
            transition={{ repeat: isPaused ? Infinity : 0, duration: 1 }}
            className="mb-8"
          >
            <span className={`text-6xl font-mono font-medium tracking-tight ${
              isPaused ? 'text-rgb-yellow' : 'text-white'
            }`}>
              {formatTime(elapsed)}
            </span>
          </motion.div>

          {/* Waveform */}
          <div className="w-full max-w-md mb-12 px-4 pointer-events-none">
            <Waveform
              data={waveformData}
              isRecording={isRecording}
              isPaused={isPaused}
              height={80}
              barWidth={4}
              barGap={3}
              primaryColor={isPaused ? '#fbbf24' : '#22d3ee'}
              secondaryColor="#262626"
            />
          </div>

          {/* Recording Indicator */}
          <div className="flex items-center gap-2 mb-8 px-4 py-2 rounded-lg bg-terminal-surface border border-terminal-border">
            <motion.div
              animate={{ opacity: isPaused ? [1, 0.3, 1] : [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: isPaused ? 1.5 : 0.8 }}
              className={`w-2 h-2 rounded-full ${isPaused ? 'bg-rgb-yellow' : 'bg-rgb-red'}`}
            />
            <span className={`text-xs font-mono font-semibold uppercase ${isPaused ? 'text-rgb-yellow' : 'text-rgb-red'}`}>
              {isPaused ? 'PAUSED' : 'RECORDING'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="relative safe-bottom px-6 pb-8 border-t border-terminal-border bg-terminal-surface/50">
          <div className="flex items-center justify-center gap-6 pt-6">
            {/* Cancel Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={cancelRecording}
              className="w-14 h-14 rounded-xl bg-terminal-surface border border-terminal-border flex items-center justify-center hover:border-rgb-red transition-colors"
            >
              <X className="w-6 h-6 text-neutral-500" />
            </motion.button>

            {/* Pause/Resume Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={pauseRecording}
              className={`w-20 h-20 rounded-xl flex items-center justify-center border transition-all ${
                isPaused 
                  ? 'bg-rgb-yellow border-rgb-yellow glow-yellow' 
                  : 'bg-terminal-hover border-terminal-border hover:border-rgb-cyan'
              }`}
            >
              {isPaused ? (
                <Play className="w-8 h-8 text-black ml-1" />
              ) : (
                <Pause className="w-8 h-8 text-neutral-300" />
              )}
            </motion.button>

            {/* Stop & Save Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => stopRecording(true)}
              className="w-14 h-14 rounded-xl bg-rgb-green border border-rgb-green flex items-center justify-center glow-green"
            >
              <Check className="w-6 h-6 text-black" />
            </motion.button>
          </div>

          <p className="text-center text-xs text-neutral-600 font-mono mt-4">
            {isPaused ? 'TAP PLAY TO RESUME' : 'TAP CHECK TO SAVE'}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RecorderV2;
