import { auth } from "@/app/(auth)/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    openaiFormData.append("response_format", "text");

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
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const text = await response.text();
    return NextResponse.json({ text });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
