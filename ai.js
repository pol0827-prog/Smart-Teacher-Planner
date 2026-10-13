// Vercel 서버 함수: Gemini 호출 (키는 환경 변수 GEMINI_API_KEY 에만 보관)
const FIREBASE_API_KEY = "AIzaSyB4CqkVov0pchCctbQkxlUaOqIubt3qmFs"; // 파이어베이스 웹 키(공개용): 로그인 확인에만 사용

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      keySet: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      allowed: !!process.env.ALLOWED_EMAIL,
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { return res.status(400).json({ error: "bad json" }); } }
  const { prompt, idToken, search } = b || {};
  if (typeof prompt !== "string" || !prompt || prompt.length > 30000) return res.status(400).json({ error: "bad prompt" });
  if (typeof idToken !== "string" || !idToken) return res.status(401).json({ error: "login required" });

  // 1) 파이어베이스 로그인 확인
  let email = "";
  try {
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
    });
    if (!v.ok) return res.status(401).json({ error: "login required" });
    email = ((await v.json()).users || [])[0]?.email || "";
  } catch { return res.status(502).json({ error: "auth check failed" }); }
  if (process.env.ALLOWED_EMAIL && email !== process.env.ALLOWED_EMAIL) return res.status(403).json({ error: "not allowed" });

  // 2) Gemini 호출 (공식 모델 gemini-1.5-flash 우선 사용)
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "server key missing" });
  const models = [process.env.GEMINI_MODEL || "gemini-1.5-flash", "gemini-2.0-flash"];
  let last = { status: 502, text: "" };
  for (const m of models) {
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
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
    if (g.status !== 404) break; // 모델 이름 오류일 때만 다음 모델 시도
  }
  return res.status(last.status === 429 ? 429 : 502).json({ error: last.status + " " + last.text });
};
