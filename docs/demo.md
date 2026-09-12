# Demo Scenario (2–5 minutes)

> Prereq: database running, knowledge base seeded (`npm run seed`), API on
> `localhost:3000`. Replace `<API_KEY>`-dependent steps by using your own key in `.env`.

## 1. Health check (15 s)

```bash
curl -s http://localhost:3000/api/health | jq
```

Expect `"status": "ok"` (or `degraded` if the DB is down — it reports honestly).

## 2. Grounded answer with sources (1 min)

```bash
curl -s -X POST http://localhost:3000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What should I do if there is a fire in the engine room?","targetLanguage":"am"}'
```

Observation points for the demo:

- `sources` shows `fire-procedure.md` chunks with similarity scores.
- `generatedResponse` is grounded, procedural, and under 120 words.
- `translatedResponse` is in Amharic (Ge'ez script).
- `metadata` shows per-stage latency and the exact models/voice.

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

Highlight that the voice is a consistent Captain voice (`onyx`) reading the **translated**
Amharic text — translation happens before TTS.

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
- **Why chunk by paragraph?** Keeps semantic units intact; boundaries are meaningful for
  procedures.
- **How is similarity computed?** Cosine distance in pgvector via HNSW approximate
  nearest-neighbor.
- **How do you stop hallucinations?** Grounding prompt, similarity threshold, "context
  insufficient" fallback, and source attribution in the trace.
- **Why translate before TTS?** The TTS reads the final translated text; it also keeps
  translation testable/auditable as its own pipeline stage.
- **Limits?** Sequential API calls = latency; OpenAI Amharic voice quality; token count
  heuristic; local audio storage.
- **Scale?** Stream/parallelize stages, add reranking + hybrid retrieval, move audio to
  object storage, add evaluation harness.