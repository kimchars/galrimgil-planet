// AI 모드의 갈림길 지도: AI가 만든 질문들이 이어진 타임라인 (누르면 그 시점으로 되돌아감)
import { useMemo } from 'react';
import { AI_STEPS, nodeMap } from '../lib/graph';
import { usePlanet } from '../store';
import { NEON } from './Globe';

export function AiTimeline({ onRewind }: { onRewind?: () => void }) {
  const { path, custom, routes, rewind, phase } = usePlanet();
  const m = useMemo(() => nodeMap(custom), [custom]);
  const answered = path.filter((s) => s.optionId).length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-300 shadow-[0_0_8px_#4FF0FF] transition-all" style={{ width: `${(Math.min(answered, AI_STEPS) / AI_STEPS) * 100}%` }} />
        </div>
        <span className="font-hud text-[11px] text-cyan-200">{Math.min(answered, AI_STEPS)}/{AI_STEPS}</span>
      </div>
      <ol className="relative space-y-2 border-l border-white/15 pl-4">
        {path.map((s, i) => {
          const n = m.get(s.nodeId);
          if (!n) return null;
          const cur = i === path.length - 1;
          const clickable = !cur && phase !== 'moving' && phase !== 'loading';
          return (
            <li key={`${s.nodeId}-${i}`} className="relative">
              <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${cur ? 'animate-blink bg-cyan-300 shadow-[0_0_8px_#4FF0FF]' : 'bg-white/50'}`} />
              <button
                disabled={!clickable}
                onClick={() => {
                  rewind(i);
                  onRewind?.();
                }}
                className={`w-full rounded-xl px-2 py-1 text-left transition ${clickable ? 'hover:bg-white/[0.06]' : ''}`}
              >
                <p className="text-[12.5px] font-bold text-white/90">
                  {n.emoji} {n.question}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {n.options.map((o, k) => {
                    const chosen = o.id === s.optionId;
                    return (
                      <span
                        key={o.id}
                        className={`rounded-md px-1.5 py-px text-[10.5px] ${chosen ? 'font-bold text-slate-950' : 'text-white/40 ring-1 ring-white/10'}`}
                        style={chosen ? { background: NEON[k % NEON.length] } : undefined}
                      >
                        {o.label}
                      </span>
                    );
                  })}
                </div>
              </button>
            </li>
          );
        })}
        {phase === 'loading' && <li className="animate-blink text-[12px] text-cyan-200">🤖 다음 갈림길 생성 중…</li>}
      </ol>
      {routes.length > 0 && <p className="mt-2 text-[11px] text-white/45">이전에 살아본 루트 {routes.length}개 · 행성 위에 다른 색 궤적으로 남아 있어요.</p>}
      <p className="mt-1 text-[11px] text-white/40">지나온 질문을 누르면 그 시점으로 돌아가 다른 선택을 해볼 수 있어요. 그 뒤의 질문은 AI가 새로 만들어요.</p>
    </div>
  );
}
