// Vercel 서버 함수: Google AI Studio(Gemini) 호출
// Gemini API 키는 Vercel 환경 변수 GEMINI_API_KEY 에만 넣습니다. (코드·GitHub에는 절대 쓰지 마세요)
const FIREBASE_API_KEY = "AIzaSyB4CqkVov0pchCctbQkxlUaOqIubt3qmFs"; // 파이어베이스 웹 키(공개용): 로그인 확인에만 사용

// 환경 변수 이름의 대소문자를 구분하지 않고 찾습니다 (예: Gemini_API_Key 도 인식)
const envName = (n) => Object.keys(process.env).find((k) => k.toUpperCase() === n);
const env = (n) => { const k = envName(n); return k ? String(process.env[k]).trim() : ""; };

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const KEY = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY");
  const MODEL = env("GEMINI_MODEL") || "gemini-2.5-flash";
  const ALLOWED = env("ALLOWED_EMAIL").toLowerCase();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      keySet: !!KEY,
      keyVar: envName("GEMINI_API_KEY") || envName("GOOGLE_API_KEY") || null, // 값이 아닌 변수 이름만 표시
      model: MODEL,
      allowed: !!ALLOWED,
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { return res.status(400).json({ error: "bad json" }); } }
  const { prompt, idToken, search } = b || {};
  if (typeof prompt !== "string" || !prompt || prompt.length > 30000) return res.status(400).json({ error: "bad prompt" });
  if (typeof idToken !== "string" || !idToken) return res.status(401).json({ error: "login required" });

  // 1) 파이어베이스 로그인 확인 (로그인한 사람만 AI 사용)
  let email = "";
  try {
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
    });
    if (!v.ok) return res.status(401).json({ error: "login required" });
    email = (((await v.json()).users || [])[0]?.email || "").toLowerCase();
  } catch { return res.status(502).json({ error: "auth check failed" }); }
  if (ALLOWED && email !== ALLOWED) return res.status(403).json({ error: "not allowed" });

  // 2) Google AI Studio(Gemini) 호출
  if (!KEY) return res.status(500).json({ error: "server key missing" });
  const models = [MODEL, "gemini-2.5-flash"];
  let last = { status: 502, text: "" };
  for (const m of models) {
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
        ...(search ? { tools: [{ google_search: {} }] } : {}),
      }),
    });
    if (g.ok) {
      const d = await g.json();
      const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      if (!text) return res.status(502).json({ error: "empty answer" });
      return res.status(200).json({ text, model: m });
    }
    last = { status: g.status, text: (await g.text()).slice(0, 300) };
    if (g.status !== 404) break; // 모델 이름 오류(404)일 때만 다음 모델 시도
  }
  return res.status(last.status === 429 ? 429 : 502).json({ error: last.status + " " + last.text });
};
