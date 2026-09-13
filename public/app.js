const form = document.getElementById('query-form');
const queryInput = document.getElementById('query');
const submitBtn = document.getElementById('submit-btn');
const charCount = document.getElementById('char-count');
const errorBox = document.getElementById('error-box');
const results = document.getElementById('results');
const audioPlayer = document.getElementById('audio-player');

const SAMPLES = [
  'There is a fire in the engine room. What should I do?',
  'A crew member has fallen overboard. What procedure must we follow?',
  'How do I report a distress call on the radio?',
  'We are losing engine power in bad weather. What should I do?',
  'Why is the anchor holding poorly and how should I re-anchor?',
];

const maxLength = Number(queryInput.maxLength);
const setCharCount = () => {
  charCount.textContent = `${queryInput.value.length} / ${maxLength}`;
};

queryInput.addEventListener('input', setCharCount);

let sampleIndex = 0;
queryInput.addEventListener('focus', () => {
  if (queryInput.placeholder.startsWith('e.g.')) {
    queryInput.placeholder = SAMPLES[sampleIndex % SAMPLES.length];
    sampleIndex += 1;
  }
});

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('btn--loading', loading);
  submitBtn.querySelector('.btn__label').textContent = loading
    ? 'Retrieving, grounding, translating, speaking…'
    : 'Ask the Captain';
}

function showError(details) {
  results.hidden = true;
  errorBox.hidden = false;
  errorBox.textContent = details;
}

function fill(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

function render(result) {
  const { translatedResponse, generatedResponse, sources, audioUrl, metadata } = result;

  audioPlayer.src = audioUrl;
  fill('translated-response', translatedResponse);
  fill('generated-response', generatedResponse);

  fill('latency', `${metadata.latencyMs} ms`);
  fill('context-note', `Retrieved ${metadata.chunkCount} chunk(s) above the similarity threshold.`);

  fill('m-embedding', metadata.models.embedding);
  fill('m-llm', metadata.models.llm);
  fill('m-translation', metadata.models.translation);
  fill('m-tts', `${metadata.models.tts} / ${metadata.models.voice}`);

  fill('t-retrieval', `${metadata.retrievalTimeMs} ms`);
  fill('t-generation', `${metadata.generationTimeMs} ms`);
  fill('t-translation', `${metadata.translationTimeMs} ms`);
  fill('t-tts', `${metadata.ttsTimeMs} ms`);

  const sourcesList = document.getElementById('sources');
  sourcesList.textContent = '';
  for (const source of sources) {
    const li = document.createElement('li');
    li.className = 'source';

    const head = document.createElement('div');
    head.className = 'source__head';
    const doc = document.createElement('span');
    doc.className = 'source__doc';
    doc.textContent = `${source.document} #${source.chunkIndex + 1}`;
    const score = document.createElement('span');
    score.className = 'source__score';
    score.textContent = `similarity ${source.similarity.toFixed(4)}`;
    head.append(doc, score);

    const text = document.createElement('p');
    text.className = 'source__text';
    text.textContent = source.content;

    li.append(head, text);
    sourcesList.append(li);
  }

  errorBox.hidden = true;
  results.hidden = false;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function parseErrorMessage(body) {
  if (body && body.error) {
    if (typeof body.error.details === 'string') return body.error.details;
    return `${body.error.code} — ${body.error.message}`;
  }
  return 'Something went wrong while contacting the assistant.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const query = queryInput.value.trim();
  const targetLanguage = document.getElementById('target-language').value;

  if (!query) {
    showError('Please enter a command or query first.');
    queryInput.focus();
    return;
  }

  errorBox.hidden = true;
  results.hidden = true;
  setLoading(true);

  try {
    const response = await fetch('/api/assistant/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, targetLanguage }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(parseErrorMessage(body));
      return;
    }

    render(body);
  } catch (err) {
    showError('Network error: could not reach the server.');
  } finally {
    setLoading(false);
  }
});