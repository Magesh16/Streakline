const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';

export class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const SYSTEM_PROMPT = `You are my personal consistency coach for a habit tracker (gym, skill upgrade, DSA practice).
You receive one week of tracked data as JSON, plus each habit's rules:
- daysPerWeek: how many days that week I must do the habit
- minutesPerDay: a day only counts if I logged at least this many minutes
- A week is complete when daysCounted >= daysPerWeek. My streak is the number of consecutive completed weeks.

Be direct, specific and honest. Use real numbers from the data. No filler, no generic motivation, no emojis.
If a habit has no data, say so plainly. Never invent sessions that are not in the data.

Reply with ONLY a JSON object of exactly this shape:
{
  "headline": string,            // one sentence verdict on the week
  "score": number,               // 0-100 overall consistency
  "summary": string,             // 2-3 sentences
  "perHabit": [ { "habit": string, "status": "great" | "ok" | "poor", "verdict": string, "note": string } ],
  "patterns": [string],          // weekday / time-of-day / duration patterns you can actually see
  "weakSpots": [string],         // e.g. DSA topics with low solve rate, gym splits skipped
  "nextWeekPlan": [string]       // 3-5 concrete, actionable changes
}`;

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('not json');
  }
}

const OVERLOADED = new Set([500, 502, 503, 504]);
const RETRY_DELAYS = [1500, 4000, 8000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini({ key, model, body }) {
  let res;
  let json;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new GeminiError(`Could not reach Gemini (${err.name === 'TimeoutError' ? 'timed out' : err.message}).`, 502);
    }
    json = await res.json().catch(() => ({}));
    // Google sheds load with 503 "high demand" on busy models; it clears in seconds, so retry quietly.
    if (OVERLOADED.has(res.status) && attempt < RETRY_DELAYS.length) {
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }
    break;
  }
  if (!res.ok) {
    if (OVERLOADED.has(res.status)) {
      throw new GeminiError(`Google says "${model}" is overloaded right now (tried ${RETRY_DELAYS.length + 1} times). Your key is fine. Try again in a minute, or switch to another model in Setup.`, 503);
    }
    const msg = json?.error?.message || `Gemini returned HTTP ${res.status}`;
    if (res.status === 429) throw new GeminiError('Gemini quota exceeded for this model. Try again later or switch model in Setup.', 429);
    if (res.status === 404) throw new GeminiError(`Model "${model}" is not available for this key. Change it in Setup. (${msg.slice(0, 160)})`, 400);
    if (res.status === 400 || res.status === 403) throw new GeminiError(`Gemini rejected the request: ${msg.slice(0, 200)}`, 400);
    throw new GeminiError(msg.slice(0, 200), 502);
  }
  return json;
}

function textOf(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
}

export async function generateInsights({ key, model, payload }) {
  const json = await callGemini({
    key,
    model,
    body: {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `Here is my week:\n${JSON.stringify(payload)}` }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 4096 },
    },
  });
  const text = textOf(json);
  if (!text) throw new GeminiError('Gemini returned an empty response. Try again.', 502);
  let data;
  try {
    data = extractJson(text);
  } catch {
    throw new GeminiError('Gemini replied, but not in the expected format. Try again.', 502);
  }
  return normalize(data);
}

export async function pingGemini({ key, model }) {
  const json = await callGemini({
    key,
    model,
    body: { contents: [{ role: 'user', parts: [{ text: 'Reply with the word ok' }] }], generationConfig: { maxOutputTokens: 64 } },
  });
  return textOf(json).trim().slice(0, 40) || 'ok';
}

const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);

/** Coerce whatever the model returned into the shape the client renders. */
function normalize(d) {
  const statuses = ['great', 'ok', 'poor'];
  return {
    headline: String(d?.headline ?? '').trim() || 'Weekly review',
    score: Math.max(0, Math.min(100, Math.round(Number(d?.score) || 0))),
    summary: String(d?.summary ?? '').trim(),
    perHabit: (Array.isArray(d?.perHabit) ? d.perHabit : []).map((h) => ({
      habit: String(h?.habit ?? '').trim(),
      status: statuses.includes(h?.status) ? h.status : 'ok',
      verdict: String(h?.verdict ?? '').trim(),
      note: String(h?.note ?? '').trim(),
    })),
    patterns: arr(d?.patterns),
    weakSpots: arr(d?.weakSpots),
    nextWeekPlan: arr(d?.nextWeekPlan),
  };
}
