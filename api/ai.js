// 버셀 서버 함수: 제미나이 호출 (키는 버셀 환경 변수 GEMINI_API_KEY 에만 보관, 브라우저에는 드러나지 않음)
// 로그인한 사람(파이어베이스 로그인 확인)만 쓸 수 있습니다.

// ===== 설정 (이 부분만 고치면 됩니다) =====
const FIREBASE_API_KEY = 'AIzaSyB4CqkVov0pchCctbQkxlUaOqIubt3qmFs'; // 파이어베이스 웹 키 (공개용, 로그인 확인에만 사용) - index.html 의 apiKey 와 같아야 함
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']; // 앞에서부터 차례로 시도
const SEARCH_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']; // 검색이 필요한 요청에 차례로 시도
// ==========================================

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// 환경 변수 이름의 대소문자를 구분하지 않고 찾습니다 (예: Gemini_API_Key 도 인식)
const envName = (n) => Object.keys(process.env).find((k) => k.toUpperCase() === n);
const env = (n) => { const k = envName(n); return k ? String(process.env[k]).trim() : ''; };

function modelList(search) {
  const first = env('GEMINI_MODEL');
  const list = search ? SEARCH_MODELS.concat(first ? [first] : []) : (first ? [first] : []).concat(MODELS);
  return list.filter((m, i) => m && list.indexOf(m) === i);
}

async function errText(r) {
  let t = '';
  try { t = await r.text(); } catch (e) {}
  try { const j = JSON.parse(t); if (j.error && j.error.message) t = j.error.message; } catch (e) {}
  return String(t).replace(/\s+/g, ' ').slice(0, 220);
}

function safeJson(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = env('GEMINI_API_KEY') || env('GOOGLE_API_KEY');

  // 점검용: 키와 모델이 실제로 살아 있는지 확인 (사용량을 쓰지 않는 조회만 함)
  if (req.method === 'GET') {
    const out = { ok: true, keySet: !!key, keyVar: envName('GEMINI_API_KEY') || envName('GOOGLE_API_KEY') || null, model: modelList(false)[0], allowed: !!env('ALLOWED_EMAIL'), version: 2, check: [] };
    if (key) {
      for (const m of modelList(false)) {
        try {
          const r = await fetch(BASE + encodeURIComponent(m), { headers: { 'x-goog-api-key': key } });
          out.check.push(r.ok ? { model: m, ok: true } : { model: m, ok: false, status: r.status, error: await errText(r) });
        } catch (e) { out.check.push({ model: m, ok: false, error: 'network' }); }
      }
    }
    return res.status(200).json(out);
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const { prompt, idToken, search } = body;
  if (typeof prompt !== 'string' || !prompt || prompt.length > 24000) return res.status(400).json({ error: 'bad prompt' });
  if (typeof idToken !== 'string' || !idToken) return res.status(401).json({ error: 'login required' });

  // 1) 파이어베이스 로그인 확인
  let email = '';
  try {
    const v = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
    });
    if (!v.ok) return res.status(401).json({ error: 'login check failed: ' + (await errText(v)) });
    const j = await v.json();
    if (!j.users || !j.users.length) return res.status(401).json({ error: 'login required' });
    email = (j.users[0].email || '').toLowerCase();
  } catch (e) { return res.status(401).json({ error: 'login check failed' }); }
  const allowed = env('ALLOWED_EMAIL').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(email)) return res.status(403).json({ error: 'not allowed' });

  // 2) 제미나이 호출: 모델을 차례로 시도하고, 하나라도 답하면 그 답을 돌려줌
  if (!key) return res.status(500).json({ error: 'server key missing' });
  const errs = [];
  let limited = false;
  // 검색 요청은 맨 앞 모델로 한 번만 검색을 시도하고, 안 되면(무료 사용분은 검색 불가) 검색 없이 인공지능 지식으로 답함
  const NOSEARCH = '(지금은 웹 검색을 쓸 수 없습니다. 검색하지 말고, 알고 있는 지식만으로 요청한 내용을 빠짐없이 채워 답하세요. 최신이 아닐 수 있어도 거절하지 말고 가장 그럴듯한 내용을 적으세요.)\n\n';
  const plan = search
    ? [{ model: modelList(true)[0], search: true }].concat(modelList(false).map(m => ({ model: m, search: false })))
    : modelList(false).map(m => ({ model: m, search: false }));
  for (const step of plan) {
    const model = step.model;
    try {
      const g = await fetch(BASE + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        signal: AbortSignal.timeout(13000), // 한 모델이 13초 안에 답하지 않으면 다음 모델로 넘어감
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(Object.assign(
          { contents: [{ role: 'user', parts: [{ text: (search && !step.search ? NOSEARCH : '') + prompt }] }], generationConfig: { maxOutputTokens: 8192 } },
          step.search ? { tools: [{ google_search: {} }] } : {}
        ))
      });
      if (!g.ok) { if (g.status === 429) limited = true; errs.push(model + ' ' + g.status + ' ' + (await errText(g))); continue; }
      const d = await g.json();
      const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
      const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
      if (text) return res.status(200).json({ text, model, searched: !!step.search });
      errs.push(model + ' empty answer');
    } catch (e) { errs.push(model + (e && e.name === 'TimeoutError' ? ' 응답 지연(13초 넘김)' : ' network')); }
  }
  return res.status(limited ? 429 : 502).json({ error: errs.join(' | ') });
};

module.exports.config = { maxDuration: 60 };
