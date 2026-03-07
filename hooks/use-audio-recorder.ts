"use client";

import { useCallback, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "transcribing";

export function useAudioRecorder(onTranscript: (text: string) => void) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer webm+opus (best compression/quality), fall back to plain webm
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopStream();
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });

        if (audioBlob.size === 0) {
          setRecordingState("idle");
          return;
        }

        setRecordingState("transcribing");

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "audio.webm");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const { error } = await response.json();
            console.error(error ?? "Transcription failed");
            return;
          }

          const { text } = await response.json();
          if (text?.trim()) {
            onTranscript(text.trim());
          }
        } catch (_error) {
          console.error("Transcription failed, please try again");
        } finally {
          setRecordingState("idle");
        }
      };

      mediaRecorder.start();
      setRecordingState("recording");
    } catch (error) {
      stopStream();
      setRecordingState("idle");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        console.error("Microphone access denied");
      } else {
        console.error("Could not start recording, please try again");
      }
    }
  }, [onTranscript, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop(); // triggers onstop → transcription
    }
  }, []);

  return { recordingState, startRecording, stopRecording };
}
