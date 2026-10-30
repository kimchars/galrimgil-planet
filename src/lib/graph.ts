// 데이터셋 접근, 마인드맵 배치, 지구 회전 계산
import * as THREE from 'three';
import raw from '../data/forks.json';
import type { Dataset, ForkNode, Option, Step } from './types';

export const DATA = raw as unknown as Dataset;
export const BASE_NODES: ForkNode[] = DATA.nodes;

export const ROUTE_COLORS = ['#FF6B8B', '#2EC4B6', '#FFB703', '#8B5CF6', '#3A86FF', '#F97316'];

export const FIELD_RATE: Record<string, string> = {
  의약: '79.4%', 교육: '71.1%', 공학: '70.4%', 사회: '69.0%', 예체능: '66.7%', 자연: '65.4%', 인문: '61.1%',
};

export function nodeMap(custom: ForkNode[]) {
  const m = new Map<string, ForkNode>();
  for (const n of BASE_NODES) m.set(n.id, n);
  for (const n of custom) m.set(n.id, n);
  return m;
}

export function optionOf(m: Map<string, ForkNode>, s: Step): Option | undefined {
  return s.optionId ? m.get(s.nodeId)?.options.find((o) => o.id === s.optionId) : undefined;
}

/* ---------- 지구 회전: 걸음마다 '앞쪽'으로 굴러간다 ---------- */
export const R = 3;
const UP = new THREE.Vector3(0, 1, 0);
export const STEP_ANGLE = 0.62;

/** 선택지 i/n 의 진행 방향 (카메라 반대쪽(-z)을 기준으로 좌우로 부채꼴) */
export function heading(i: number, n: number) {
  if (n <= 1) return 0;
  const spread = n === 2 ? 1.7 : Math.min(3.0, 1.0 * (n - 1));
  return -spread / 2 + (spread * i) / (n - 1);
}
export function dirOf(theta: number) {
  return new THREE.Vector3(Math.sin(theta), 0, -Math.cos(theta));
}

/** 걸음들을 적용한 지구 자세와, 각 걸음의 지구 위(로컬) 좌표 */
export function walk(m: Map<string, ForkNode>, steps: Step[]) {
  const q = new THREE.Quaternion();
  const pts: THREE.Vector3[] = [UP.clone().multiplyScalar(R)];
  for (const s of steps) {
    const node = m.get(s.nodeId);
    if (!node || !s.optionId) continue;
    const i = node.options.findIndex((o) => o.id === s.optionId);
    if (i < 0) continue;
    const d = dirOf(heading(i, node.options.length));
    const axis = new THREE.Vector3().crossVectors(d, UP).normalize();
    const dq = new THREE.Quaternion().setFromAxisAngle(axis, STEP_ANGLE);
    q.premultiply(dq);
    const local = UP.clone().multiplyScalar(R).applyQuaternion(q.clone().invert());
    pts.push(local);
  }
  return { q, pts };
}

/** 두 지표점 사이 대원호 (지면에서 살짝 띄움) */
export function arc(a: THREE.Vector3, b: THREE.Vector3, lift = 1.012, seg = 20) {
  const out: THREE.Vector3[] = [];
  const an = a.clone().normalize();
  const bn = b.clone().normalize();
  const ang = an.angleTo(bn);
  for (let k = 0; k <= seg; k++) {
    const t = k / seg;
    const v = ang < 1e-4 ? an.clone() : an.clone().multiplyScalar(Math.sin((1 - t) * ang) / Math.sin(ang)).add(bn.clone().multiplyScalar(Math.sin(t * ang) / Math.sin(ang)));
    out.push(v.normalize().multiplyScalar(R * lift));
  }
  return out;
}

/* ---------- 마인드맵 배치 ---------- */
export interface MapLayout {
  pos: Record<string, { x: number; y: number }>;
  edges: { from: string; to: string }[];
  width: number;
  height: number;
}

export function layout(m: Map<string, ForkNode>, start: string): MapLayout {
  // 시작점에서 BFS로 층 나누기 (사용자 추가 갈림길은 부모 바로 아래 층)
  const level: Record<string, number> = { [start]: 0 };
  const order: string[] = [start];
  const q = [start];
  while (q.length) {
    const id = q.shift()!;
    const n = m.get(id);
    if (!n) continue;
    for (const o of n.options)
      for (const nx of o.next)
        if (level[nx] === undefined && m.has(nx) && !m.get(nx)!.custom) {
          level[nx] = level[id] + 1;
          order.push(nx);
          q.push(nx);
        }
  }
  for (const n of m.values()) {
    if (n.custom && level[n.custom.parent] !== undefined && level[n.id] === undefined) {
      level[n.id] = level[n.custom.parent] + 0.5;
      order.push(n.id);
    }
  }
  const rows: Record<string, string[]> = {};
  for (const id of order) (rows[String(level[id])] ??= []).push(id);
  const keys = Object.keys(rows).map(Number).sort((a, b) => a - b);
  const W = 320;
  const ROW = 64;
  const pos: MapLayout['pos'] = {};
  keys.forEach((lv, r) => {
    const ids = rows[String(lv)];
    ids.forEach((id, i) => {
      pos[id] = { x: ((i + 1) * W) / (ids.length + 1), y: 34 + r * ROW };
    });
  });
  const seen = new Set<string>();
  const edges: MapLayout['edges'] = [];
  for (const id of order) {
    const n = m.get(id)!;
    for (const o of n.options)
      for (const nx of o.next) {
        const k = `${id}>${nx}`;
        if (pos[nx] && !seen.has(k)) {
          seen.add(k);
          edges.push({ from: id, to: nx });
        }
      }
  }
  return { pos, edges, width: W, height: 34 + keys.length * ROW };
}

/** 통계 근거 카드 (서버 STATS와 같은 순서·같은 ID) — AI는 이 ID로만 통계를 인용한다 */
export const STAT_LIBRARY: { id: string; text: string; src: string }[] = (() => {
  const seen = new Set<string>();
  const out: { id: string; text: string; src: string }[] = [];
  for (const n of BASE_NODES) {
    for (const st of [...n.stats, ...n.options.map((o) => o.stat).filter(Boolean)] as { text: string; src: string }[]) {
      if (seen.has(st.text)) continue;
      seen.add(st.text);
      out.push({ id: `s${out.length + 1}`, text: st.text, src: st.src });
    }
  }
  return out;
})();
export const STAT_BY_ID = Object.fromEntries(STAT_LIBRARY.map((s) => [s.id, s]));

/** AI 모드에서 서버가 안 될 때 이어 갈 기본 분기점 순서 */
export const FALLBACK_ORDER = ['major', 'leave', 'work-exp', 'cert', 'project', 'after-grad', 'company', 'first-job', 'move', 'home'];
export const AI_STEPS = 10;
