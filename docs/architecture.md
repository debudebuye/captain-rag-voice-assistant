# Architecture Diagram

## High-level system

```mermaid
flowchart LR
    subgraph Client
        C[Captain CLI / curl / UI]
    end

    subgraph API[Node.js + Express API]
        R[POST /api/assistant/query]
        H[GET /api/health]
        P[Assistant Pipeline]
        RD[Retrieval stage]
        GE[Generation stage]
        TR[Translation stage]
        TT[TTS stage]
    end

    subgraph Store[PostgreSQL + pgvector]
        KB[(chunks table + HNSW index)]
    end

    subgraph FreeApis[Free-tier services]
        EM[Cloudflare Workers AI embeddings]
        LLM[Groq qwen3.8-27b generate]
        TRA[Groq qwen3.8-27b translate]
        TTSA[edge-tts local (am voice)]
    end

    C --> R
    C --> H
    R --> P

    P --> RD --> EM
    RD --> KB

    P --> GE --> LLM
    P --> TR --> TRA
    P --> TT --> TTSA

    TT --> F[(audio/ *.mp3)]
    F -->|static /audio| C

    P -->|trace JSON| C
```

## Data flow and artifacts

| Stage | Input | Output | Artifact |
|---|---|---|---|
| Load | `knowledge-base/*.md` | `KBDocument[]` | 10 documents |
| Chunk | documents | `DocumentChunk[]` | ~20 chunks, `id`, `document`, `chunkIndex`, `content` |
| Embed | chunk content | `number[][]` | 1024-dim vectors |
| Index | chunks + vectors | pgvector rows | `chunks` table, HNSW cosine index |
| Retrieve | question text | `RetrievalResult[]` | top-k with `document`, `content`, `score` |
| Generate | question + context | grounded text | answer + `usedContext` flag |
| Translate | answer | target-language text | Amharic string |
| Synthesize | translated text | `.mp3` file | audio path + URL |
| Respond | all of the above | `PipelineResult` | trace JSON with latency per stage |

## Project tree

```
captain-rag-voice-assistant/
├── src/
│   ├── config/env.ts                  # zod-validated environment
│   ├── modules/
│   │   ├── rag/
│   │   │   ├── loader.ts              # read .md files
│   │   │   ├── chunker.ts             # paragraph chunker + token estimate
│   │   │   ├── embeddings.ts          # Cloudflare Workers AI embeddings client
│   │   │   ├── vectorStore.ts         # pgvector schema + search
│   │   │   └── index.ts               # RAG orchestrator (index/retrieve)
│   │   ├── llm/
│   │   │   ├── prompt.ts              # grounding system prompt + context formatter
│   │   │   └── generator.ts           # grounded generation client
│   │   ├── translation/translator.ts  # EN → target-language client
│   │   ├── tts/synthesizer.ts         # speech synthesis + file persistence
│   │   └── assistant/
│   │       ├── di.ts                  # composition root (real clients)
│   │       └── pipeline.ts            # stage orchestration + trace + timings
│   ├── routes/                        # Express routes
│   ├── middleware/errorHandler.ts     # centralized errors
│   └── shared/                        # logger, errors, db pool, types
├── knowledge-base/                    # 10 SAMPLE maritime documents
├── scripts/seed-kb.ts                 # one-time indexing script
├── tests/unit | tests/integration     # vitest suites
├── docs/demo.md                       # demo script + interview notes
├── Dockerfile                         # multi-stage TS build → node runtime
└── docker-compose.yml                 # db (pgvector) + api
```

## Request lifecycle timings

- Retrieval: 150–300 ms (embedding call + HNSW query)
- Generation: 800–1500 ms
- Translation: 700–1300 ms
- TTS: 2500–4000 ms (audio synthesis dominates)
- Total: ~5–8 s per warm request