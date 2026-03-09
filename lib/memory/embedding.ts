import "server-only";

import { gateway } from "@ai-sdk/gateway";
import { embed, embedMany as sdkEmbedMany } from "ai";

const embeddingModel = gateway.textEmbeddingModel("google/text-embedding-004");

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel, value: text });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const { embeddings } = await sdkEmbedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}
