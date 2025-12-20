
import React, { useState, useRef } from 'react';

interface RecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
}

const Recorder: React.FC<RecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunks, { type: mimeType || 'audio/ogg' });
        onRecordingComplete(blob, duration);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      
      if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (err) {
      console.error("Failed to start recording", err);
      alert("Please allow microphone access to record notes.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
      if ('vibrate' in navigator) navigator.vibrate([30, 30]);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 relative">
      {/* Timer Display */}
      <div className="mb-8 relative z-10">
        <div className={`text-4xl font-mono font-medium tracking-wider transition-colors duration-300 ${
          isRecording ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-slate-400'
        }`}>
          {isRecording ? formatTime(elapsed) : "0:00"}
        </div>
        {isRecording && (
           <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* Main Record Button */}
      <div className="relative">
        {/* Outer Ring / Ripple */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-[ping_2s_linear_infinite]" />
        )}
        <div className={`absolute inset-0 rounded-full bg-red-500/10 transition-transform duration-300 ${isRecording ? 'scale-150' : 'scale-100'}`} />

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="relative z-20 w-20 h-20 rounded-full border-[3px] border-slate-200 flex items-center justify-center transition-all duration-200 active:scale-95 focus:outline-none"
        >
            <div 
                className={`bg-red-500 transition-all duration-300 ease-in-out ${
                    isRecording 
                    ? 'w-8 h-8 rounded-md' // Stop Square
                    : 'w-16 h-16 rounded-full' // Record Circle
                }`}
            />
        </button>
      </div>
      
      <p className={`mt-6 text-sm font-medium transition-colors duration-300 ${isRecording ? 'text-red-400/80' : 'text-slate-500'}`}>
        {isRecording ? 'Recording...' : 'Tap to record'}
      </p>
    </div>
  );
};

export default Recorder;
