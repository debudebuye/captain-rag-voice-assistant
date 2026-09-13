# Captain RAG Voice Assistant

![Captain RAG Voice Assistant](docs/banner.svg)

A RAG-based voice assistant for ship/captain operations. The Captain sends a text
command, and the system retrieves the relevant procedure from a maritime knowledge base,
generates a grounded answer, translates it into a target language (default **Amharic**),
and speaks it back using a consistent Captain voice.

> **Demo project.** The knowledge base content is labeled `SAMPLE — demo knowledge base`
> and is NOT official maritime guidance. Do not use it for real ship operations.

## Pipeline

```
Captain text
      │
      ▼
  POST /api/assistant/query
      │
      ▼
 ┌──────────────┐    ┌──────────────┐    ┌────────────────┐    ┌───────────────┐
 │  Retrieval   │    │  Generation   │    │  Translation   │    │     TTS       │
 │  embedding + │───▶│  grounded LLM │───▶│   EN → Amharic │───▶│  captain voice │
 │  pgvector    │    │  answer       │    │                │    │  .mp3 output  │
 └──────────────┘    └──────────────┘    └────────────────┘    └───────────────┘
      │                    │                     │                     │
      └────────────────────┴─────────────────────┴─────────────────────┘
                                   Full pipeline trace (sources, latency, models)
```

Every request returns a complete **pipeline trace**: retrieved chunks with sources and
similarity scores, the grounded answer, the translated text, the audio URL, per-stage
latency, and the models/voice used.

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or a local
  PostgreSQL 15+ with the `pgvector` extension)
- A free [Groq API key](https://console.groq.com) (LLM + translation)
- A [Cloudflare API token](https://dash.cloudflare.com) with Workers AI permission (embeddings)
- Python 3 + `edge-tts` for free TTS: `pip install edge-tts`
- Node.js 18+ for local development

### 1. Configure

```bash
cp .env.example .env
# Paste your keys into GROQ_API_KEY=..., CLOUDFLARE_API_TOKEN=... and CLOUDFLARE_ACCOUNT_ID=...
```

### 2. Start the database and the API

```bash
docker compose up --build
```

This starts PostgreSQL with pgvector on `:5432` and the API on `http://localhost:3000`.

### 3. Index the knowledge base (one time)

```bash
docker compose exec api npm run seed
# or, when running locally:
npm run seed
```

The seed script loads the 10 markdown documents in `knowledge-base/`, chunks them into
~20 pieces, generates embeddings, and stores them in pgvector.

### 4. Ask the Captain

```bash
curl -X POST http://localhost:3000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "There is a fire in the engine room. What should I do?", "targetLanguage": "am"}'
```

The response includes:

```jsonc
{
  "query": "There is a fire in the engine room. What should I do?",
  "targetLanguage": "am",
  "generatedResponse": "First sound the alarm...",
  "translatedResponse": "በመጀመሪያ ማንቂያውን ያሰሙ። ...",
  "sources": [
    {
      "document": "fire-procedure.md",
      "chunkIndex": 1,
      "content": "An engine-room fire is one of the most dangerous situations...",
      "similarity": 0.82
    }
  ],
  "audioUrl": "/audio/እሳት-ነው-1f3a9b2c.mp3",
  "metadata": {
    "latencyMs": 5213,
    "models": { "embedding": "@cf/baai/bge-m3", "llm": "qwen/qwen3.8-27b",
                "translation": "qwen/qwen3.8-27b", "tts": "edge-tts", "voice": "am-ET-AmehaNeural" },
    "chunkCount": 4,
    "retrievalTimeMs": 180, "generationTimeMs": 950,
    "translationTimeMs": 900, "ttsTimeMs": 3100
  }
}
```

Play the audio:

```bash
curl -o answer.mp3 http://localhost:3000/audio/<filename>.mp3
# or open http://localhost:3000/audio/<filename>.mp3 in a browser
```

### Web UI

The project ships a simple browser UI (vanilla HTML/CSS/JS, no build step). Open
[`http://localhost:3000`](http://localhost:3000) and you can:

1. Type a command / query in the text box.
2. Pick an output language (default Amharic).
3. Hit **Ask the Captain** — the page shows the grounded answer, the translated text,
   an audio player for the synthesized voice response, the retrieved source chunks with
   similarity scores, and a per-stage pipeline trace.

### Health check

```bash
curl http://localhost:3000/api/health
```

## Running Locally Without Docker

```bash
cp .env.example .env        # set GROQ_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and DATABASE_URL
npm install
npm run dev                 # tsx watch, TypeScript running directly
```

Start a local PostgreSQL with pgvector, create the `captain_rag` database, then
`npm run seed`.

## Tests

```bash
npm run test                 # unit + integration
npm run test:unit            # fast, no external dependencies
npm run test:integration     # needs PostgreSQL+pgvector reachable at DATABASE_URL
npm run typecheck
```

The integration suite uses a deterministic fake embedding so it can exercise the real
pgvector pipeline without an API key. It **skips** gracefully if the database is
unreachable.

## Architecture

### Project structure

```
src/
├── modules/
│   ├── rag/            # loader, chunker, embeddings, vectorStore, orchestrator
│   ├── llm/            # prompt builder + grounded generator
│   ├── translation/    # EN → target-language translator
│   ├── tts/            # speech synthesis + audio file handling
│   └── assistant/      # pipeline orchestrator + dependency wiring
├── routes/             # Express routes (assistant, health)
├── middleware/         # centralized error handler
├── shared/             # logger, typed errors, DB pool, shared types
└── config/             # zod-validated environment configuration

public/                 # web UI (index.html, style.css, app.js) served at /
```

### Why these choices

| Decision | Reasoning |
|---|---|
| **Node.js + TypeScript** | Team strength; strict mode catches bugs; honest and productive |
| **PostgreSQL + pgvector** | Mature, single database for structured + vector data; HNSW index is production-ready |
| **Paragraph-based chunking** | Preserves semantic boundaries and sections; simple to reason about |
| **Groq for LLM + translation** | Free tier, fast Llama models, strong multilingual output |
| **Cloudflare for embeddings** | Workers AI `bge-m3` is multilingual (100+ languages) and free-tier friendly |
| **edge-tts for speech** | Free, no key; consistent male voice per language. *Not a voice clone* — see Limitations |
| **Zod validation** | Runtime-safe request parsing + typed config |
| **Pino logging** | Structured JSON logs, cheap, pipeline-friendly |

### How RAG works here

1. **Chunk** each document into coherent paragraph-groups (target `CHUNK_SIZE=500`
   tokens, `CHUNK_OVERLAP=50`).
2. **Embed** every chunk with `@cf/baai/bge-m3` (1024-dim) via Cloudflare Workers AI.
3. **Store** vectors in PostgreSQL with an HNSW index on cosine distance.
4. **At query time**, embed the question and fetch the top-`k` chunks with
   `ORDER BY embedding <=> $1`, filtered by a similarity threshold.
5. **Generate** with a system prompt that says *answer ONLY from the `<context>` block*,
   cite sources, and refuse to answer if the context is insufficient.
6. **Translate** the grounded answer to the target language.
7. **Synthesize** the translated text with the configured voice.

### Hallucination prevention

- Strict grounding system prompt (context-only answers).
- A hard-coded safety fallback when the context is insufficient.
- Similarity threshold filters out irrelevant chunks.
- Sources are returned in the trace for auditability.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | *(required)* | Groq API key (LLM + translation) |
| `CLOUDFLARE_API_TOKEN` | *(required)* | Cloudflare API token with Workers AI permission (embeddings) |
| `CLOUDFLARE_ACCOUNT_ID` | *(required)* | Cloudflare account ID (embeddings) |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | OpenAI-compatible base URL |
| `DATABASE_URL` | `postgresql://captain:captain@localhost:5432/captain_rag` | PostgreSQL connection |
| `PORT` | `3000` | API port |
| `EMBEDDING_MODEL` | `@cf/baai/bge-m3` | Embedding model (1024-dim, multilingual) |
| `LLM_MODEL` | `qwen/qwen3.8-27b` | Answer generation model |
| `TRANSLATION_MODEL` | `qwen/qwen3.8-27b` | Translation model |
| `TTS_MODEL` | `edge-tts` | TTS engine |
| `TTS_VOICE` | `am-ET-AmehaNeural` | Default voice; supported target languages auto-select a native male voice |
| `TOP_K` | `5` | Chunks retrieved per query |
| `CHUNK_SIZE` | `500` | Target tokens per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap tokens between chunks |
| `SIMILARITY_THRESHOLD` | `0.35` | Minimum cosine similarity to count a chunk as relevant |
| `VECTOR_DIMENSIONS` | `1024` | Must match the embedding model (`@cf/baai/bge-m3` = 1024) |
| `AUDIO_DIR` | `./audio` | Where generated audio files are stored |

## Demo Scenario (2–5 minutes)

See [docs/demo.md](docs/demo.md) for a step-by-step demo script with prepared prompts
covering: a correct grounded answer, an answer with sources, the unknown-question safety
fallback, and the audio playback.

For demo feedback or questions, contact: **debadeba015@gmail.com**

## Limitations

- **Latency**: three sequential service calls (generate → translate → TTS) add a few
  seconds per request. In production, translate+TTS could stream or be parallelized.
- **Amharic TTS quality**: edge-tts's single Amharic voice (`am-ET-AmehaNeural`) is decent
  but a dedicated Amharic TTS vendor may be better in production.
- **Voice is not a clone**: the "Captain voice" is a fixed Microsoft neural voice profile
  per language (`am-ET-AmehaNeural`, `en-US-ChristopherNeural`, etc.), not a clone of a real
  person's voice. This is the tradeoff for a free, keyless, multilingual TTS. True voice
  cloning (e.g., ElevenLabs, Azure Custom Neural Voice) would fix a Captain's own
  recording as the profile for every language but costs money and still needs a licensed
  voice model.
- **Token heuristic**: chunk sizing uses a characters-per-token approximation. A real
  tokenizer (tiktoken) would be exact.
- **Local file audio store**: fine for a demo; a production system would use object
  storage (S3) with CDN.
- **No auth / rate limiting**: intentionally out of scope for this assignment.
- **Free-tier limits**: Groq and Cloudflare Workers AI free tiers have rate limits; heavy
  load needs quotas or a paid plan.

## Improvements for Production

- Async pipeline (queue) with streaming responses and early-TTS overlap.
- Reranking (e.g., cross-encoder) after vector search.
- Hybrid retrieval (BM25 + vectors).
- Evaluation harness with a labeled Q&A set to tune `TOP_K`, threshold, and chunk size.
- Multi-tenancy and per-language indexes.
- Object storage + CDN for audio, deduplication by content hash.
- Voice cloning (ElevenLabs / Azure Custom Neural Voice) to lock the Captain's real voice
  as the profile across all output languages.
- Metrics/tracing (OpenTelemetry) and an audit store for the trace.

## Security Notes

- The `.env` file holds your API key and is gitignored; never commit it.
- `npm audit` reports moderate dev-time advisories (vitest/esbuild) and a moderate `qs`
  DoS advisory inherited from Express 4. They are acceptable for a demo; upgrade to
  Express 5 before production.

## License

MIT (sample project; not for operational use).