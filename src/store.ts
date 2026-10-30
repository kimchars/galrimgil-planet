import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BASE_NODES, DATA, ROUTE_COLORS } from './lib/graph';
import type { ForkNode, Option, Profile, Route, Step } from './lib/types';

export type Phase = 'loading' | 'question' | 'moving' | 'result' | 'ended';
export type Mode = 'ai' | 'data';

interface State {
  profile: Profile | null;
  custom: ForkNode[];
  path: Step[];
  routes: Route[];
  phase: Phase;
  mode: Mode;
  scenes: Record<string, string>;
  start: (p: Profile) => void;
  choose: (optionId: string) => void;
  arrived: () => void;
  goNext: (nodeId: string | null) => void;
  rewind: (index: number) => void;
  addCustom: (n: ForkNode) => void;
  /** AI가 만든 다음 질문으로 이동 */
  pushNode: (n: ForkNode) => void;
  /** AI 첫 질문을 못 받았을 때 기본 데이터로 시작 */
  startData: () => void;
  setLoading: () => void;
  /** 사용자가 직접 만든 선택지를 질문에 추가 */
  addOption: (nodeId: string, opt: Option) => void;
  setScene: (k: string, v: string) => void;
  reset: () => void;
}

const safe = createJSONStorage(() => {
  try {
    localStorage.setItem('__p', '1');
    localStorage.removeItem('__p');
    return localStorage;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  }
});

const sig = (steps: Step[]) => steps.map((s) => `${s.nodeId}:${s.optionId ?? ''}`).join('>');

/** 지금 경로를 기록에 남긴다 (같은 경로가 이미 있으면 갱신) */
function archive(routes: Route[], path: Step[], ended: boolean): Route[] {
  const done = path.filter((s) => s.optionId);
  if (done.length < 1) return routes;
  const s = sig(done);
  const same = routes.find((r) => sig(r.steps) === s);
  if (same) return routes.map((r) => (r === same ? { ...r, ended: r.ended || ended } : r));
  // 지금 경로가 기존 경로의 연장이면 그 경로를 덮어쓴다
  const prefix = routes.find((r) => s.startsWith(sig(r.steps)) && !r.ended);
  if (prefix) return routes.map((r) => (r === prefix ? { ...r, steps: done, ended } : r));
  return [...routes, { id: `r${Date.now().toString(36)}`, color: ROUTE_COLORS[routes.length % ROUTE_COLORS.length], steps: done, ended }];
}

export const usePlanet = create<State>()(
  persist(
    (set, get) => ({
      profile: null,
      custom: [],
      path: [],
      routes: [],
      phase: 'question',
      mode: 'ai',
      scenes: {},
      start: (p) => {
        // AI 모드로 시작: 첫 질문은 App이 받아와서 pushNode로 넣는다
        set({ profile: p, path: [], routes: [], custom: [], phase: 'loading', mode: 'ai', scenes: {} });
      },
      startData: () => {
        const p = get().profile;
        const startId = (p && DATA.startByGrade[p.grade]) || DATA.start;
        set({ path: [{ nodeId: startId }], phase: 'question', mode: 'data' });
      },
      setLoading: () => set({ phase: 'loading' }),
      addOption: (nodeId, opt) => {
        const { custom } = get();
        const node = custom.find((c) => c.id === nodeId) ?? BASE_NODES.find((n) => n.id === nodeId);
        if (!node) return;
        const updated = { ...node, options: [...node.options.filter((o) => o.id !== opt.id), opt] };
        set({ custom: [...custom.filter((c) => c.id !== nodeId), updated] });
      },
      pushNode: (n) => {
        const { path, custom, routes } = get();
        set({ custom: [...custom.filter((c) => c.id !== n.id), n], path: [...path, { nodeId: n.id }], phase: 'question', routes: archive(routes, path, false) });
      },
      choose: (optionId) => {
        const { path, phase } = get();
        if (phase !== 'question' || !path.length) return;
        const last = path[path.length - 1];
        set({ path: [...path.slice(0, -1), { ...last, optionId }], phase: 'moving' });
      },
      arrived: () => get().phase === 'moving' && set({ phase: 'result' }),
      goNext: (nodeId) => {
        const { path, routes } = get();
        if (!nodeId) {
          set({ phase: 'ended', routes: archive(routes, path, true) });
          return;
        }
        const next = [...path, { nodeId }];
        set({ path: next, phase: 'question', routes: archive(routes, path, false) });
      },
      rewind: (index) => {
        const { path, routes } = get();
        if (index < 0 || index >= path.length) return;
        const kept = path.slice(0, index + 1).map((s, i) => (i === index ? { nodeId: s.nodeId } : s));
        set({ routes: archive(routes, path, false), path: kept, phase: 'question' });
      },
      addCustom: (n) => {
        const { path, custom } = get();
        // 지금 질문 대신 사용자 질문으로 들어갔다가, 답을 고르면 원래 질문으로 돌아온다
        set({ custom: [...custom.filter((c) => c.id !== n.id), n], path: [...path.slice(0, -1), { nodeId: n.id }], phase: 'question' });
      },
      setScene: (k, v) => set((s) => ({ scenes: { ...s.scenes, [k]: v } })),
      reset: () => set({ profile: null, path: [], routes: [], custom: [], phase: 'question', mode: 'ai', scenes: {} }),
    }),
    {
      name: 'galrimgil-20s-v2',
      version: 2,
      storage: safe,
      partialize: (s) => ({ profile: s.profile, custom: s.custom, path: s.path, routes: s.routes, scenes: s.scenes, mode: s.mode, phase: s.phase === 'moving' ? 'result' : s.phase === 'loading' && s.path.length ? 'result' : s.phase }),
    },
  ),
);

export { sig };
