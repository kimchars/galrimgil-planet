// 서버(AI) 호출 + 실패 시 규칙 기반 대체
import { z } from 'zod';
import { SCENES } from '../data/scenes';
import type { ForkNode, Option, Profile } from './types';
import { STAT_BY_ID } from './graph';
import { ALLOWED_TAGS } from './jobs';

const TIMEOUT = 12000;

async function post<T>(url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: c.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return schema.parse(await res.json());
  } finally {
    clearTimeout(t);
  }
}

function fill(s: string, p: Profile | null) {
  return s
    .replace(/\{name\}/g, p?.name || '나')
    .replace(/\{field\}/g, p?.field ?? '내')
    .replace(/\{interest\}/g, p?.interests[0] ?? '관심 분야');
}

/* ---------- 그 시점의 한 장면 ---------- */
const SceneZ = z.object({ scene: z.string().min(5).max(400) });

export async function fetchScene(args: { profile: Profile | null; node: ForkNode; option: Option; history: string[]; ai: boolean }): Promise<{ text: string; by: 'ai' | 'mock' }> {
  const { profile, node, option, history, ai } = args;
  if (ai) {
    try {
      const r = await post('/api/scene', { profile, question: node.question, choice: option.label, history }, SceneZ);
      return { text: r.scene, by: 'ai' };
    } catch {
      /* 대체 */
    }
  }
  await new Promise((r) => setTimeout(r, 350));
  const t = SCENES[`${node.id}:${option.id}`];
  if (t) return { text: fill(t, profile), by: 'mock' };
  return { text: `'${option.label}'을(를) 고른 뒤, 일상의 리듬이 조금 달라졌다. 이 선택이 나에게 맞는지 확인하는 시간이 시작됐다.`, by: 'mock' };
}

/* ---------- 내 질문 → 갈림길 만들기 ---------- */
const BranchZ = z.object({
  question: z.string().min(2).max(60),
  options: z
    .array(z.object({ label: z.string().min(1).max(24), gains: z.array(z.string().max(40)).max(3), costs: z.array(z.string().max(40)).max(3) }))
    .min(2)
    .max(5),
});

function splitOptions(q: string): string[] | null {
  const t = q.trim().replace(/\s+/g, ' ');
  const norm = t.replace(/(까|래|지)\s*[,，]\s*/g, '$1? ').replace(/(까|래)\s+(?=\S.*까)/, '$1? ');
  const parts = norm
    .split(/\s*(?:[?？]|아니면|\bvs\.?\b|VS|또는)\s*/i)
    .map((p) => p.replace(/^[,\s]+|[,\s]+$/g, ''))
    .filter(Boolean);
  if (parts.length >= 2 && !/^말까/.test(parts[1])) return parts.slice(0, 4).map((p) => p.replace(/\s*(할까|갈까|딸까|볼까|살까|해볼까)$/, '').slice(0, 20));
  const m = t.match(/(.+?)\s*(할까|갈까|해볼까)?\s*말까/);
  if (m) return [`${m[1].trim()} 한다`, `${m[1].trim()} 안 한다`, '조금 더 알아본다'];
  return null;
}

export async function fetchBranch(args: { question: string; profile: Profile | null; parent: ForkNode; ai: boolean }): Promise<ForkNode> {
  const { question, profile, parent, ai } = args;
  const id = `custom-${Date.now().toString(36)}`;
  const base = { id, stage: parent.stage, short: question.replace(/[?？]/g, '').slice(0, 6), emoji: '✨', stats: [] as ForkNode['stats'] };
  if (ai) {
    try {
      const r = await post('/api/branch', { question, profile, context: parent.question }, BranchZ);
      return {
        ...base,
        question: r.question,
        custom: { by: 'ai', returnTo: parent.id, parent: parent.id },
        options: r.options.map((o, i) => ({ id: `o${i}`, label: o.label, gains: o.gains, costs: o.costs, next: [parent.id] })),
      };
    } catch {
      /* 대체 */
    }
  }
  await new Promise((r) => setTimeout(r, 400));
  const labels = splitOptions(question) ?? ['해본다', '하지 않는다', '조금 더 알아본다'];
  return {
    ...base,
    question: question.trim(),
    custom: { by: 'mock', returnTo: parent.id, parent: parent.id },
    options: labels.map((l, i) => ({
      id: `o${i}`,
      label: l,
      gains: ['직접 해보며 나에게 맞는지 확인'],
      costs: ['시간과 비용을 다른 곳에 쓰지 못함'],
      next: [parent.id],
    })),
  };
}

/* ---------- AI 질문 엔진 ---------- */
const NextZ = z.object({
  emoji: z.string(),
  short: z.string(),
  stage: z.enum(['S1', 'S2', 'S3']),
  question: z.string().min(2),
  context: z.string().optional().default(''),
  statIds: z.array(z.string()).default([]),
  options: z
    .array(z.object({ label: z.string().min(1), gains: z.array(z.string()), costs: z.array(z.string()), gives: z.array(z.string()), statId: z.string().nullable().optional() }))
    .min(2)
    .max(5),
});
export interface HistoryItem { question: string; choice: string; gives: string[] }

const nextCache = new Map<string, Promise<ForkNode | null>>();

/** 다음 질문을 AI로 생성 (같은 경로면 캐시 → 결과 화면에서 미리 받아두기) */
export function fetchNext(args: { key: string; step: number; profile: Profile | null; history: HistoryItem[]; tags: string[]; parent: string }): Promise<ForkNode | null> {
  const hit = nextCache.get(args.key);
  if (hit) return hit;
  const p = (async () => {
    try {
      const r = await post('/api/next', { profile: args.profile, step: args.step, history: args.history, tags: args.tags }, NextZ);
      const id = `ai-${Date.now().toString(36)}-${args.step}`;
      const node: ForkNode = {
        id,
        stage: r.stage,
        short: r.short.slice(0, 6) || `질문${args.step}`,
        emoji: r.emoji || '🔀',
        question: r.question,
        context: r.context,
        stats: (r.statIds ?? []).map((sid) => STAT_BY_ID[sid]).filter(Boolean).map((s) => ({ text: s.text, src: s.src })),
        custom: { by: 'ai', returnTo: '', parent: args.parent, kind: 'main' },
        options: r.options.map((o, i) => {
          const st = o.statId ? STAT_BY_ID[o.statId] : undefined;
          return {
            id: `o${i}`,
            label: o.label,
            gains: o.gains,
            costs: o.costs,
            gives: o.gives.filter((g) => ALLOWED_TAGS.includes(g)),
            stat: st ? { text: st.text, src: st.src } : undefined,
            next: [],
          };
        }),
      };
      return node;
    } catch {
      nextCache.delete(args.key);
      return null;
    }
  })();
  nextCache.set(args.key, p);
  return p;
}

/* ---------- 15개 직군 AI 추천 ---------- */
const RecZ = z.object({
  overall: z.string(),
  top: z.array(z.object({ jobId: z.string(), fit: z.number(), summary: z.string(), evidence: z.array(z.object({ text: z.string(), from: z.string() })), gaps: z.array(z.string()), actions: z.array(z.string()) })).min(1),
});
export type Recommendation = z.infer<typeof RecZ>;

export async function fetchRecommend(args: { profile: Profile | null; life: { question: string; choice: string }[]; tags: string[]; ruleScores: Record<string, number> }): Promise<Recommendation | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 35000);
    try {
      const res = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: c.signal });
      if (!res.ok) return null;
      return RecZ.parse(await res.json());
    } finally {
      clearTimeout(t);
    }
  } catch {
    return null;
  }
}

/* ---------- 직접 입력한 갈림길 → 선택지 ---------- */
const ClassZ = z.object({ label: z.string(), gains: z.array(z.string()), costs: z.array(z.string()), gives: z.array(z.string()) });
const KEYWORD_TAGS: [RegExp, string[]][] = [
  [/박사/, ['phd', 'research']],
  [/대학원|석사/, ['master', 'research']],
  [/논문|연구/, ['research', 'paper']],
  [/창업|사업/, ['startup', 'project']],
  [/로봇|ROS/i, ['robotics']],
  [/자율주행|모빌리티|자동차/, ['autonomous']],
  [/임베디드|펌웨어|하드웨어|아두이노/, ['embedded']],
  [/비전|영상|이미지/, ['cv', 'ml']],
  [/머신러닝|딥러닝|AI|인공지능/i, ['ml']],
  [/데이터/, ['data_pipeline']],
  [/서버|백엔드|API/i, ['backend']],
  [/클라우드|AWS/i, ['cloud']],
  [/공기업|공공|공무원|NCS/i, ['ncs_gsat']],
  [/해외|유학|워홀/, ['global']],
  [/인턴|현장/, ['intern']],
  [/프로젝트|포트폴리오|대회|해커톤|공모전/, ['project', 'award']],
  [/코딩테스트|알고리즘/, ['algo']],
  [/PLC|제어|자동화/i, ['plc']],
  [/설계|CAD/i, ['cad']],
  [/시뮬레이션|디지털 ?트윈/, ['sim']],
];

export async function fetchClassify(args: { profile: Profile | null; question: string; text: string }): Promise<Option> {
  const id = `user-${Date.now().toString(36)}`;
  try {
    const r = await post('/api/classify', args, ClassZ);
    return { id, label: r.label, gains: r.gains, costs: r.costs, gives: r.gives.filter((g) => ALLOWED_TAGS.includes(g)), next: [] };
  } catch {
    const gives = [...new Set(KEYWORD_TAGS.filter(([re]) => re.test(args.text)).flatMap(([, t]) => t))].slice(0, 3);
    return { id, label: args.text.slice(0, 18), gains: ['내가 정한 방향으로 직접 나아감'], costs: ['정해진 길보다 불확실함'], gives, next: [] };
  }
}
