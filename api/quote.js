// 버셀 서버 함수: 관심 종목 시세 (포털 누리집의 공개 시세를 받아 옴. 키가 필요 없음)
// 쓰는 법: /api/quote?codes=367380,360200
// 비공식 창구라 어느 날 막힐 수 있습니다. 그때는 이 파일의 SRC 주소와 아래 항목 이름만 바꾸면 됩니다.
const SRC = 'https://m.stock.naver.com/api/stock/';

const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('status ' + r.status);
  return r.json();
};

async function one(code) {
  try {
    const [b, p] = await Promise.all([get(SRC + code + '/basic'), get(SRC + code + '/price?pageSize=5&page=1').catch(() => [])]);
    if (!b || !b.stockName) return { code, error: 'not found' };
    const at = String(b.localTradedAt || '');
    return {
      code,
      name: b.stockName,
      price: num(b.closePrice),
      diff: num(b.compareToPreviousClosePrice),
      rate: num(b.fluctuationsRatio),
      at: at.slice(5, 10) + ' ' + at.slice(11, 16),
      status: b.marketStatus || '',
      days: (Array.isArray(p) ? p : []).slice(0, 5).map((d) => ({ d: String(d.localTradedAt || '').slice(5, 10), close: num(d.closePrice), rate: num(d.fluctuationsRatio) })),
    };
  } catch (e) { return { code, error: 'failed' }; }
}

module.exports = async (req, res) => {
  const q = (req.query && req.query.codes) || '';
  const codes = String(q).split(',').map((x) => x.trim().toUpperCase()).filter((x, i, a) => /^[0-9A-Z]{6}$/.test(x) && a.indexOf(x) === i).slice(0, 12);
  const list = await Promise.all(codes.map(one));
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({ list });
};

module.exports.config = { maxDuration: 20 };
