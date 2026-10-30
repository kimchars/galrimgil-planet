// AI 질문 엔진: 'loading'이면 다음 질문을 받아오고, 결과 화면에선 다음 질문을 미리 받아둔다
import { useEffect } from 'react';
import { fetchNext, type HistoryItem } from './api';
import { AI_STEPS, BASE_NODES, FALLBACK_ORDER, nodeMap, optionOf } from './graph';
import { tagsOf } from './jobs';
import { sig, usePlanet } from '../store';
import type { ForkNode, Step } from './types';

function context(path: Step[], custom: ForkNode[]) {
  const m = nodeMap(custom);
  const done = path.filter((s) => s.optionId);
  const history: HistoryItem[] = done.map((s) => {
    const n = m.get(s.nodeId);
    const o = optionOf(m, s);
    return { question: n?.question ?? '', choice: o?.label ?? '', gives: o?.gives ?? [] };
  });
  return { done, history };
}

export const answeredCount = (path: Step[]) => path.filter((s) => s.optionId).length;

export function useAiEngine() {
  const { phase, path, custom, profile, mode, pushNode, startData } = usePlanet();

  // 다음 질문 받기
  useEffect(() => {
    if (phase !== 'loading' || !profile) return;
    let alive = true;
    const { done, history } = context(path, custom);
    const tags = [...tagsOf(done, custom, profile)];
    const last = path[path.length - 1];
    fetchNext({ key: sig(path), step: Math.min(AI_STEPS, done.length + 1), profile, history, tags, parent: last?.nodeId ?? '' }).then((node) => {
      if (!alive || usePlanet.getState().phase !== 'loading') return;
      if (node) {
        pushNode(node);
        return;
      }
      // AI 실패 → 기본 데이터로 이어 가기
      if (!path.length) {
        startData();
        return;
      }
      const visited = new Set(path.map((s) => s.nodeId));
      const nextId = FALLBACK_ORDER.find((id) => !visited.has(id));
      const base = BASE_NODES.find((n) => n.id === nextId);
      if (base) {
        usePlanet.setState({ mode: 'data' });
        pushNode(base);
      } else usePlanet.setState({ phase: 'result' });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, path.length]);

  // 결과를 읽는 동안 다음 질문 미리 받기
  useEffect(() => {
    if (phase !== 'result' || mode !== 'ai' || !profile) return;
    const { done, history } = context(path, custom);
    if (done.length >= AI_STEPS) return;
    const m = nodeMap(custom);
    const cur = m.get(path[path.length - 1]?.nodeId);
    if (!cur?.custom || cur.custom.kind !== 'main') return;
    const tags = [...tagsOf(done, custom, profile)];
    void fetchNext({ key: sig(path), step: done.length + 1, profile, history, tags, parent: cur.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, path]);
}
