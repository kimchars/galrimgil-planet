// server.js — 갈림길 행성 AI 백엔드 (Express, 파일 하나)
// 실행: cd server && npm i && node server.js   (Node 18+)
//
// POST /api/scene   { profile, question, choice, history[] } → { scene }      (1년 뒤의 한 장면)
// POST /api/branch  { question, profile, context }            → { question, options[] } (내 고민 → 갈림길)
// GET  /api/health
// 실패(키 없음·시간 초과·형식 오류)하면 503 → 프론트가 예시 장면/예시 갈림길로 대체한다.

try { require('dotenv').config(); } catch { /* dotenv 없이도 동작 */ }
const express = require('express');
const cors = require('cors');
const { z } = require('zod');

const PORT = Number(process.env.PORT) || 8787;
const PROVIDER = (process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'anthropic')).toLowerCase();
const LLM_TIMEOUT_MS_REF = { v: Number(process.env.LLM_TIMEOUT_MS) || 12000 };
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());

const SYSTEM = `너는 '갈림길 행성'의 서술자다. 20대 사용자가 인생의 분기점을 미리 체험하도록 돕는다.
규칙:
- 반드시 JSON 객체 하나만 출력한다. 마크다운·설명 금지.
- 한국어. 담백하고 구체적인 장면 묘사. 과장·훈계 금지.
- 통계·연봉·합격률 같은 숫자는 절대 지어내지 않는다(숫자는 앱이 공식 통계로 따로 보여준다).
- 특정 기업·학교·실존 인물 이름을 쓰지 않는다.`;

async function fetchWithTimeout(url, options, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...options, signal: c.signal }); } finally { clearTimeout(t); }
}
async function callAnthropic(prompt) {
  if (!ANTHROPIC_API_KEY) throw new Error('NO_ANTHROPIC_KEY');
  const res = await fetchWithTimeout(`${ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1800, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
  }, LLM_TIMEOUT_MS_REF.v);
  if (!res.ok) throw new Error(`ANTHROPIC_HTTP_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b && b.type === 'text').map((b) => b.text).join('');
  if (!text) throw new Error('ANTHROPIC_EMPTY');
  return text;
}
async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) throw new Error('NO_OPENAI_KEY');
  const res = await fetchWithTimeout(`${OPENAI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, temperature: 0.8, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }] }),
  }, LLM_TIMEOUT_MS_REF.v);
  if (!res.ok) throw new Error(`OPENAI_HTTP_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OPENAI_EMPTY');
  return text;
}
const callLLM = (p) => (PROVIDER === 'openai' ? callOpenAI(p) : callAnthropic(p));
/** 오래 걸리는 분석(추천)용: 타임아웃만 길게 */
async function callLLMLong(p, ms) {
  const keep = LLM_TIMEOUT_MS_REF.v;
  LLM_TIMEOUT_MS_REF.v = ms;
  try { return await callLLM(p); } finally { LLM_TIMEOUT_MS_REF.v = keep; }
}
function extractJson(raw) {
  const text = String(raw).replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = text.indexOf('{'); const e = text.lastIndexOf('}');
  if (s === -1 || e <= s) throw new Error('NO_JSON_OBJECT');
  return JSON.parse(text.slice(s, e + 1));
}
const cut = (v, n) => String(v ?? '').trim().slice(0, n);

const ProfileZ = z.object({ name: z.string().max(10).optional(), field: z.string().max(10).optional(), grade: z.string().max(5).optional(), interests: z.array(z.string().max(12)).max(3).optional() }).nullable().optional();
const SceneReq = z.object({ profile: ProfileZ, question: z.string().min(2).max(80), choice: z.string().min(1).max(40), history: z.array(z.string().max(40)).max(20).default([]) });
const BranchReq = z.object({ profile: ProfileZ, question: z.string().trim().min(2).max(60), context: z.string().max(80).optional() });

const who = (p) => (p ? `${p.name || '사용자'} (${p.field || '?'}계열, 관심: ${(p.interests || []).join(', ') || '없음'})` : '사용자');

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_q, res) => res.json({ ok: true, provider: PROVIDER, hasKey: PROVIDER === 'openai' ? !!OPENAI_API_KEY : !!ANTHROPIC_API_KEY }));
const fail = (res, tag, err) => {
  const reason = err?.name === 'AbortError' ? 'TIMEOUT' : err?.message || String(err);
  console.warn(`[${tag}] fallback: ${reason}`);
  res.status(503).json({ error: 'LLM_UNAVAILABLE', reason });
};

app.post('/api/scene', async (req, res) => {
  const b = SceneReq.safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'BAD_REQUEST' });
  const { profile, question, choice, history } = b.data;
  const prompt = `주인공: ${who(profile)}
지금까지 고른 길: ${history.join(' → ') || '(없음)'}
방금 마주친 분기점: "${question}"
고른 선택: "${choice}"

이 선택을 하고 약 1년이 지난 어느 날의 한 장면을 2~3문장, 현재형으로 써라. 오감이 느껴지는 구체적인 순간 하나. 좋은 점과 아쉬운 점이 함께 느껴지게. 숫자 금지.
출력: {"scene":"..."}`;
  try {
    const r = z.object({ scene: z.string().min(5) }).parse(extractJson(await callLLM(prompt)));
    res.json({ scene: cut(r.scene, 300) });
  } catch (e) { fail(res, 'scene', e); }
});

app.post('/api/branch', async (req, res) => {
  const b = BranchReq.safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'BAD_REQUEST' });
  const { profile, question, context } = b.data;
  const prompt = `주인공: ${who(profile)}
지금 시점의 큰 분기점: "${context || ''}"
주인공이 추가한 고민: "${question}"

이 고민을 20대의 갈림길로 만들어라. 현실적인 선택지 2~4개(서로 겹치지 않게). 각 선택지마다 얻는 것 1~2개, 잃는 것 1~2개를 짧게(각 25자 이내). 숫자 금지.
출력: {"question":"정리된 질문(30자 이내)","options":[{"label":"선택지(14자 이내)","gains":["..."],"costs":["..."]}]}`;
  try {
    const r = z.object({ question: z.string().min(2), options: z.array(z.object({ label: z.string().min(1), gains: z.array(z.string()).default([]), costs: z.array(z.string()).default([]) })).min(2) }).parse(extractJson(await callLLM(prompt)));
    res.json({
      question: cut(r.question, 40),
      options: r.options.slice(0, 4).map((o) => ({ label: cut(o.label, 20), gains: o.gains.slice(0, 2).map((g) => cut(g, 36)), costs: o.costs.slice(0, 2).map((c) => cut(c, 36)) })),
    });
  } catch (e) { fail(res, 'branch', e); }
});

/* =========================================================
 * AI 질문 엔진 + 15개 직군 추천
 * ========================================================= */
const path = require('path');
const fs = require('fs');
const FORKS = require('../src/data/forks.json');
const JOBS_FILE = path.join(__dirname, '../src/data/jobs15.json');
const loadJobs = () => JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')).jobs; // 매 요청마다 읽어서 공고 수정이 바로 반영됨

// 통계 근거 카드: 프론트(graph.ts statLibrary)와 같은 순서·같은 ID
const STATS = (() => {
  const seen = new Set(); const out = [];
  for (const n of FORKS.nodes) {
    for (const st of [...n.stats, ...n.options.map((o) => o.stat).filter(Boolean)]) {
      if (seen.has(st.text)) continue; seen.add(st.text);
      out.push({ id: `s${out.length + 1}`, text: st.text, src: st.src });
    }
  }
  return out;
})();

const TAGS = {
  major_stem: '이공계 전공', major_deep: '전공 심화', major_double: '복수전공', math: '수학·통계 기초', algo: '코딩테스트 대비', cpp: 'C/C++',
  project: '프로젝트 결과물', award: '공모전·해커톤 수상', startup: '창업 경험', ml: '머신러닝·딥러닝 프로젝트', cv: '컴퓨터비전 프로젝트',
  backend: '서버·API 개발', cloud: '클라우드', data_pipeline: '데이터 파이프라인', robotics: '로봇·ROS 경험', autonomous: '자율주행 대회·프로젝트',
  embedded: '임베디드·펌웨어', plc: 'PLC·제어 실습', cad: '기구설계·CAD', sim: '시뮬레이션·디지털트윈', research: '연구 경험(학부연구생)', paper: '논문 실적',
  master: '석사', phd: '박사', intern: '인턴·현장 경험', global: '해외 경험', cert_jungcheo: '정보처리기사', cert_sqld: 'SQLD', cert_adsp: 'ADsP',
  cert_bigdata: '빅데이터분석기사', cert_eng: '기사 자격증(전기·전자·기계)', cert_security: '정보보안기사', toeic: '공인어학(토익·오픽)',
  ncs_gsat: 'NCS·인적성 대비', civil_prep: '공무원 시험 대비',
};
const TAG_IDS = Object.keys(TAGS);
const STAGE_PLAN = ['학부 1~2학년: 전공·동아리·연구실 탐색', '학부 2~3학년: 휴학·현장 경험·진로 방향', '학부 3학년: 자격증·어학', '학부 3~4학년: 프로젝트·공모전·대회', '학부 4학년: 인턴·연구실', '졸업 직전: 취업 vs 대학원 vs 공공기관 준비', '졸업 후: 첫 지원 전략', '첫 직장·대학원 1년차', '20대 후반: 이직·전문화', '20대 후반: 장기 커리어 방향'];

const NextReq = z.object({
  profile: ProfileZ,
  step: z.number().int().min(1).max(10),
  history: z.array(z.object({ question: z.string().max(80), choice: z.string().max(40), gives: z.array(z.string()).max(8).default([]) })).max(12).default([]),
  tags: z.array(z.string()).max(40).default([]),
});
const NextRes = z.object({
  emoji: z.string().max(8).default('🔀'), short: z.string().min(1), stage: z.string().optional(), question: z.string().min(4), context: z.string().optional(),
  statIds: z.array(z.string()).max(3).default([]),
  options: z.array(z.object({ label: z.string().min(1), gains: z.array(z.string()).default([]), costs: z.array(z.string()).default([]), gives: z.array(z.string()).default([]), statId: z.string().nullable().optional() })).min(2).max(5),
});

app.post('/api/next', async (req, res) => {
  const b = NextReq.safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'BAD_REQUEST' });
  const { profile, step, history, tags } = b.data;
  const jobs = loadJobs().map((j) => `${j.name}(${j.group})`).join(', ');
  const prompt = `너는 20대 진로 시뮬레이션의 '갈림길 설계자'다. 사용자가 지금까지 산 삶을 보고, 다음에 마주칠 가장 의미 있는 분기점 질문 하나와 갈림길(선택지)을 만든다.

주인공: ${who(profile)}
진행: ${step}/10 단계 — 이번 단계의 시기 가이드: ${STAGE_PLAN[step - 1]}
지금까지의 선택:
${history.map((h, i) => `${i + 1}. ${h.question} → ${h.choice}`).join('\n') || '(첫 질문)'}
모은 스펙 태그: ${tags.join(', ') || '없음'}
도착 후보 직군(15개): ${jobs}

규칙:
- 질문은 앞선 선택의 결과로 자연스럽게 이어져야 하고, 이전 질문과 겹치지 않는다.
- 15개 직군 중 어디로 갈지가 갈리는 분기점이 되게 한다(예: 로보틱스 동아리 vs 데이터 분석 학회, 정처기 vs 임베디드 프로젝트, 석사 vs 공기업 준비).
- 선택지 2~4개(가끔 5개), 서로 확실히 다른 길. label 14자 이내.
- 각 선택지의 gives는 아래 태그 ID 목록에서만 0~3개 고른다(목록 밖 금지).
  태그: ${TAG_IDS.map((t) => `${t}=${TAGS[t]}`).join(', ')}
- gains/costs는 각각 1~2개, 25자 이내, 숫자 금지.
- 통계 수치는 절대 직접 쓰지 말고, 관련 있는 근거 카드가 있을 때만 ID로 인용한다(질문 statIds 최대 2개, 선택지 statId 0~1개). 관련 없으면 비워라.
  근거 카드: ${STATS.map((s) => `${s.id}: ${s.text}`).join(' | ')}
- context: 이 시점의 상황을 담백하게 한 문장(40자 이내).
- short: 지도에 쓸 2~6자 이름. emoji: 이모지 1개. stage: S1(대학) | S2(졸업 전후) | S3(첫 직장 이후).

출력(JSON만): {"emoji":"","short":"","stage":"S1","question":"","context":"","statIds":[],"options":[{"label":"","gains":[""],"costs":[""],"gives":[""],"statId":null}]}`;
  try {
    const r = NextRes.parse(extractJson(await callLLM(prompt)));
    const statOk = new Set(STATS.map((s) => s.id));
    res.json({
      emoji: cut(r.emoji, 4) || '🔀',
      short: cut(r.short, 6),
      stage: ['S1', 'S2', 'S3'].includes(r.stage) ? r.stage : step <= 5 ? 'S1' : step <= 7 ? 'S2' : 'S3',
      question: cut(r.question, 50),
      context: cut(r.context, 60),
      statIds: r.statIds.filter((x) => statOk.has(x)).slice(0, 2),
      options: r.options.slice(0, 5).map((o) => ({
        label: cut(o.label, 18),
        gains: o.gains.slice(0, 2).map((g) => cut(g, 30)),
        costs: o.costs.slice(0, 2).map((c) => cut(c, 30)),
        gives: [...new Set(o.gives.filter((g) => TAG_IDS.includes(g)))].slice(0, 3),
        statId: o.statId && statOk.has(o.statId) ? o.statId : null,
      })),
    });
  } catch (e) { fail(res, 'next', e); }
});

const RecReq = z.object({
  profile: ProfileZ,
  life: z.array(z.object({ question: z.string().max(80), choice: z.string().max(40) })).max(20),
  tags: z.array(z.string()).max(40).default([]),
  ruleScores: z.record(z.number()).default({}),
});
const RecRes = z.object({
  overall: z.string().default(''),
  top: z.array(z.object({
    jobId: z.string(), fit: z.number().min(0).max(100), summary: z.string(),
    evidence: z.array(z.object({ text: z.string(), from: z.string().default('route') })).default([]),
    gaps: z.array(z.string()).default([]), actions: z.array(z.string()).default([]),
  })).min(1).max(5),
});

app.post('/api/recommend', async (req, res) => {
  const b = RecReq.safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'BAD_REQUEST' });
  const { profile, life, tags, ruleScores } = b.data;
  const jobs = loadJobs();
  const jobText = jobs.map((j) => {
    const posts = (j.postings || []).slice(0, 3).map((p, i) => `  공고${i + 1}(${p.company_type || '?'}): 자격요건: ${cut(p.requirements, 400)} / 우대: ${cut(p.preferred, 250)}`).join('\n');
    const base = j.reqs.map((r) => `${r.label}[${r.kind}]`).join(', ');
    return `- id=${j.id} | ${j.name} (${j.group}) | 규칙점수 ${ruleScores[j.id] ?? '?'}%\n  기본 요구: ${base}${posts ? `\n${posts}` : '\n  (실제 공고 미등록: 기본 요구로만 판단)'}`;
  }).join('\n');
  const prompt = `너는 IT·공학 진로 분석가다. 주인공이 시뮬레이션에서 살아온 20대의 선택들을 보고, 15개 직군 중 가장 잘 맞는 TOP 3를 고른다.

주인공: ${who(profile)}
살아온 선택:
${life.map((l, i) => `${i + 1}. ${l.question} → ${l.choice}`).join('\n')}
모은 스펙: ${tags.map((t) => TAGS[t] || t).join(', ') || '없음'}

직군과 채용 요구(공고 원문이 있으면 그것을 우선 근거로):
${jobText}

규칙:
- 반드시 위 id 중에서 3개를 고른다. 규칙점수는 참고하되, 선택의 흐름(무엇에 시간을 썼는지)과 공고 요구를 함께 본다.
- fit: 0~100 정수. 규칙점수와 30점 이상 차이 나면 summary에 이유를 밝힌다.
- evidence 2~3개: 주인공의 선택 또는 공고 요구를 짧게 인용(from: "route" 또는 "posting").
- gaps 1~3개: 그 직군 공고 기준 부족한 것.
- actions 3개: 지금 바로 할 수 있는 구체적 행동(시험 일정·합격률 같은 숫자는 지어내지 말 것).
- overall: 이 사람의 20대 루트를 한 문장으로 총평.
- 회사 이름을 추천하지 말 것.

출력(JSON만): {"overall":"","top":[{"jobId":"","fit":0,"summary":"","evidence":[{"text":"","from":"route"}],"gaps":[""],"actions":["","",""]}]}`;
  try {
    const r = RecRes.parse(extractJson(await callLLMLong(prompt, 30000)));
    const ids = new Set(jobs.map((j) => j.id));
    const top = r.top.filter((t) => ids.has(t.jobId)).slice(0, 3).map((t) => ({
      jobId: t.jobId, fit: Math.round(t.fit), summary: cut(t.summary, 200),
      evidence: t.evidence.slice(0, 3).map((e) => ({ text: cut(e.text, 90), from: e.from === 'posting' ? 'posting' : 'route' })),
      gaps: t.gaps.slice(0, 3).map((g) => cut(g, 60)), actions: t.actions.slice(0, 3).map((a) => cut(a, 80)),
    }));
    if (!top.length) throw new Error('NO_VALID_JOB');
    res.json({ overall: cut(r.overall, 120), top });
  } catch (e) { fail(res, 'recommend', e); }
});

/* 사용자가 직접 입력한 마지막 갈림길 → 선택지로 정리 */
const ClassReq = z.object({ profile: ProfileZ, question: z.string().max(80).default(''), text: z.string().trim().min(2).max(60) });
app.post('/api/classify', async (req, res) => {
  const b = ClassReq.safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'BAD_REQUEST' });
  const { profile, question, text } = b.data;
  const prompt = `주인공: ${who(profile)}
분기점 질문: "${question}"
주인공이 직접 적은 자신만의 길: "${text}"

이 길을 선택지 하나로 정리해라.
- label: 14자 이내로 다듬은 이름(원래 뜻 유지)
- gains/costs: 각 1~2개, 25자 이내, 숫자 금지
- gives: 이 길로 얻게 될 스펙 태그 0~3개, 아래 목록에서만: ${TAG_IDS.map((t) => `${t}=${TAGS[t]}`).join(', ')}
출력(JSON만): {"label":"","gains":[""],"costs":[""],"gives":[""]}`;
  try {
    const r = z.object({ label: z.string().min(1), gains: z.array(z.string()).default([]), costs: z.array(z.string()).default([]), gives: z.array(z.string()).default([]) }).parse(extractJson(await callLLM(prompt)));
    res.json({ label: cut(r.label, 18), gains: r.gains.slice(0, 2).map((g) => cut(g, 30)), costs: r.costs.slice(0, 2).map((c) => cut(c, 30)), gives: [...new Set(r.gives.filter((g) => TAG_IDS.includes(g)))].slice(0, 3) });
  } catch (e) { fail(res, 'classify', e); }
});

app.use((err, _q, res, _n) => { console.error('[server]', err); if (!res.headersSent) res.status(500).json({ error: 'SERVER_ERROR' }); });
if (require.main === module) app.listen(PORT, () => console.log(`[server] http://localhost:${PORT} provider=${PROVIDER} key=${(PROVIDER === 'openai' ? OPENAI_API_KEY : ANTHROPIC_API_KEY) ? 'yes' : 'NO (프론트가 예시로 대체)'}`));
module.exports = { app, extractJson };
