# Audio Transcription Implementation Reference

How audio-to-text was implemented in the Personal OS chatbot app.
Extracted for reuse in a new project.

---

## Overview

**Stack:** Browser `MediaRecorder` API → Next.js API route → OpenAI `gpt-4o-mini-transcribe`

No OpenAI SDK — just a raw `fetch` to OpenAI's REST endpoint.

---

## Environment Variable

```
OPENAI_API_KEY=sk-...
```

---

## 1. API Route — `app/api/transcribe/route.ts`

Accepts `multipart/form-data` with an `audio` field, forwards it to OpenAI, returns `{ text }`.

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const audio = formData.get("audio") as Blob;

    if (!audio) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large (max 25MB)" },
        { status: 400 }
      );
    }

    const openaiFormData = new FormData();
    openaiFormData.append("file", audio, "audio.webm");
    openaiFormData.append("model", "gpt-4o-mini-transcribe");
    openaiFormData.append("response_format", "text"); // returns plain text, not JSON

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: openaiFormData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[transcribe] OpenAI error:", error);
      return NextResponse.json(
        { error: "Transcription failed" },
        { status: 500 }
      );
    }

    // response_format=text means OpenAI returns a plain string, not JSON
    const text = await response.text();
    return NextResponse.json({ text });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
```

**Key details:**
- `response_format: "text"` → OpenAI returns a plain string, so use `response.text()` not `response.json()`
- 25MB limit enforced before the API call (OpenAI's own limit)
- Add auth guard (`if (!session) return 401`) if your app has authentication

---

## 2. Client Hook — `hooks/use-audio-recorder.ts`

Manages the full lifecycle: request mic permission → record → stop → POST to API → return transcript via callback.

```ts
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
        // Microphone access denied — show a user-facing error
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
```

---

## 3. Wiring Into a Component

```tsx
function ChatInput() {
  const [input, setInput] = useState("");

  const { recordingState, startRecording, stopRecording } = useAudioRecorder(
    (transcript) => setInput((prev) => prev + transcript) // append to existing input
  );

  return (
    <div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} />
      <button
        onClick={recordingState === "recording" ? stopRecording : startRecording}
        disabled={recordingState === "transcribing"}
      >
        {recordingState === "idle" && "🎤 Record"}
        {recordingState === "recording" && "⏹ Stop"}
        {recordingState === "transcribing" && "…"}
      </button>
    </div>
  );
}
```

---

## State Machine

```
idle ──[startRecording]──→ recording ──[stopRecording]──→ transcribing ──→ idle
                                                                ↓
                                                       onTranscript(text) called
```

---

## What OpenAI Receives

```
POST https://api.openai.com/v1/audio/transcriptions
Authorization: Bearer $OPENAI_API_KEY
Content-Type: multipart/form-data

file:            audio.webm  (the recorded blob, named "audio.webm")
model:           gpt-4o-mini-transcribe
response_format: text
```

---

## Notes

- **No npm package needed** — raw `fetch` to the OpenAI REST API is sufficient
- **`gpt-4o-mini-transcribe`** is the cheapest/fastest Whisper model as of early 2026; alternatives are `gpt-4o-transcribe` (higher accuracy) and `whisper-1` (older)
- **iOS Safari** supports `audio/mp4` not `audio/webm` — if you need mobile support, add a fallback: check `MediaRecorder.isTypeSupported("audio/mp4")` and send that instead. OpenAI accepts both.
- The hook uses `ondataavailable` to collect chunks, then assembles them into one `Blob` on stop — this is the standard pattern for `MediaRecorder`
