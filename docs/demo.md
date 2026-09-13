# Demo Scenario (2–5 minutes)

> Prereq: database running, knowledge base seeded (`npm run seed`), API on
> `localhost:3000`. Replace `<API_KEY>`-dependent steps by using your own key in `.env`.

## 1. Health check (15 s)

```bash
curl -s http://localhost:3000/api/health | jq
```

Expect `"status": "ok"` (or `degraded` if the DB is down — it reports honestly).

## 1b. Optional: start the demo from the web UI (30 s)

Open **http://localhost:3000** in a browser — this is the primary interface you'll demo.
Type the query below (or use the placeholder rotation in the input), pick a language, and
press **Ask the Captain**. The page renders the answer, translation, audio player, sources,
and trace inline. The `curl` steps below exercise the same API.

## 2. Grounded answer with sources (1 min)

```bash
curl -s -X POST http://localhost:3000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What should I do if there is a fire in the engine room?","targetLanguage":"am"}'
```

Observation points for the demo:

- `sources` shows `fire-procedure.md` chunks with similarity scores.
- `generatedResponse` is grounded, procedural, and under 120 words.
- `translatedResponse` is in Amharic (Ge'ez/Ethiopic script).
- `metadata` shows per-stage latency and the exact models/voice (`@cf/baai/bge-m3`,
  `qwen3.8-27b`, `am-ET-AmehaNeural`).

## 3. A second, different domain (30 s)

```bash
curl -s -X POST http://localhost:3000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query":"A crew member has fallen overboard at night. What is the manoeuvre?","targetLanguage":"am"}'
```

Expected: `man-overboard.md` retrieved; answer explains the Williamson turn and the
expanding-square search.

## 4. Safety: unknown question (45 s)

```bash
curl -s -X POST http://localhost:3000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query":"How much cargo insurance does the company carry?","targetLanguage":"am"}'
```

Expected: the system does **not** fabricate an answer. It replies with the fallback
"In the knowledge base I do not have enough information to answer that question"
and no invented numbers. This is the hallucination-prevention moment of the demo.

## 5. Audio playback (1 min)

Play the audio URL from step 2:

```bash
curl -o answer.mp3 http://localhost:3000/audio/<filename>.mp3
start answer.mp3    # or open it in a browser
```

Highlight that the voice is a consistent Captain voice profile (`am-ET-AmehaNeural` male
Amharic voice for the default language; each supported output language auto-selects a
native male voice) reading the **translated** Amharic text — translation happens before TTS.

## 6. Trace explanation (1 min)

Show the request log in the server terminal:

```json
{
  "msg": "Pipeline completed",
  "chunkCount": 4,
  "retrievalTimeMs": 180,
  "generationTimeMs": 950,
  "translationTimeMs": 900,
  "ttsTimeMs": 3100,
  "totalLatencyMs": 5213
}
```

Explain the stages and where each number comes from.

---

## Interview talking points (from this demo)

- **Why PostgreSQL + pgvector?** One database for data + vectors; HNSW index is
  production-grade; no extra infra.
- **Why Cloudflare Workers AI for embeddings?** Free tier, multilingual `bge-m3` (100+
  languages, 1024-dim) fits the Amharic content without a dedicated embedding host.
- **Why chunk by paragraph?** Keeps semantic units intact; boundaries are meaningful for
  procedures.
- **How is similarity computed?** Cosine distance in pgvector via HNSW approximate
  nearest-neighbor.
- **How do you stop hallucinations?** Grounding prompt, similarity threshold, "context
  insufficient" fallback, and source attribution in the trace.
- **Why translate before TTS?** The TTS reads the final translated text; it also keeps
  translation testable/auditable as its own pipeline stage.
- **Why edge-tts instead of voice cloning?** Free, keyless, and multilingual. It reads in a
  fixed Microsoft neural voice per language rather than a cloned Captain voice — a known
  tradeoff: real cloning (e.g. ElevenLabs) would be the production upgrade.
- **Limits?** Sequential API calls = latency; edge-tts voice is a fixed neural profile, not
  a clone; token count heuristic; local audio storage; free-tier rate limits.
- **Scale?** Stream/parallelize stages, add reranking + hybrid retrieval, move audio to
  object storage, add evaluation harness.