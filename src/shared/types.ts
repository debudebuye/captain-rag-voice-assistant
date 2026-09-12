export interface DocumentChunk {
  id: string;
  document: string;
  chunkIndex: number;
  content: string;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
}

export interface SourceReference {
  document: string;
  chunkIndex: number;
  content: string;
  similarity?: number;
}

export interface PipelineResult {
  query: string;
  targetLanguage: string;
  retrievedChunks: SourceReference[];
  generatedResponse: string;
  translatedResponse: string;
  audioUrl: string;
  audioPath: string;
  sources: SourceReference[];
  metadata: {
    latencyMs: number;
    models: {
      embedding: string;
      llm: string;
      translation: string;
      tts: string;
      voice: string;
    };
    chunkCount: number;
    retrievalTimeMs: number;
    generationTimeMs: number;
    translationTimeMs: number;
    ttsTimeMs: number;
  };
}

export interface AssistantQuery {
  query: string;
  targetLanguage: string;
}