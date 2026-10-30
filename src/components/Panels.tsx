// 질문 패널 / 결과 패널 (유리 HUD)
import { useEffect, useMemo, useState } from 'react';
import { DATA, FIELD_RATE, nodeMap, optionOf } from '../lib/graph';
import { fetchScene } from '../lib/api';
import { AGE } from '../data/scenes';
import { sig, usePlanet } from '../store';
import { NEON } from './Globe';
import type { ForkNode, Stat } from '../lib/types';
import { TAG_LABEL } from '../lib/jobs';
import { AI_STEPS } from '../lib/graph';
import { answeredCount } from '../lib/useAiEngine';

const NEXT_AGE: Record<string, string> = { S1: '22살', S2: '25살', S3: '28살' };

function StatLine({ s, strong }: { s: Stat; strong?: boolean }) {
  const src = DATA.sources[s.src];
  return (
    <li className={`flex items-start gap-2 text-[13px] leading-snug ${strong ? 'text-white' : 'text-white/75'}`}>
      <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_8px_#4FF0FF]" />
      <span>
        {s.text}{' '}
        {src && (
          <a href={src.refs[0]} target="_blank" rel="noreferrer" className="whitespace-nowrap rounded bg-white/10 px-1.5 py-px text-[10px] text-cyan-200/80 hover:bg-white/20" title={`${src.by} · ${src.name}`}>
            출처 · {src.by.split('(')[0].split('·')[0]}
          </a>
        )}
      </span>
    </li>
  );
}

export function QuestionPanel({ node, onPick, onAdd }: { node: ForkNode; onPick: (id: string) => void; onAdd: () => void }) {
  const profile = usePlanet((s) => s.profile);
  const answered = usePlanet((s) => answeredCount(s.path));
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = Number(e.key);
      if (k >= 1 && k <= node.options.length) onPick(node.options[k - 1].id);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [node, onPick]);

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-center gap-2">
        <span className="hud-label">Fork · {AGE[node.stage]}</span>
        {node.custom?.kind === 'main' ? (
          <span className="rounded-md bg-cyan-300/15 px-2 py-0.5 text-[11px] font-bold text-cyan-200">🤖 AI가 내 삶을 보고 만든 갈림길 · {Math.min(AI_STEPS, answered + 1)}/{AI_STEPS}</span>
        ) : (
          node.custom && <span className="rounded-md bg-amber-300/20 px-2 py-0.5 text-[11px] font-bold text-amber-200">✨ {node.custom.by === 'ai' ? 'AI가 만든 갈림길' : '예시 규칙으로 만든 갈림길'} · 통계 근거 없음</span>
        )}
      </div>
      <h2 className="mt-1 font-display text-2xl text-white sm:text-3xl">
        {node.emoji} {node.question}
      </h2>
      {node.context && <p className="mt-1 text-[13px] text-white/60">{node.context}</p>}
      {(node.stats.length > 0 || node.id === 'major') && (
        <ul className="mt-2 space-y-1">
          {node.id === 'major' && profile && <StatLine strong s={{ text: `내 계열(${profile.field}) 취업률 ${FIELD_RATE[profile.field]}`, src: 'HE2024' }} />}
          {node.stats.map((s) => (
            <StatLine key={s.text} s={s} />
          ))}
        </ul>
      )}
      <div className="mt-3 flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
        {node.options.map((o, i) => {
          const c = NEON[i % NEON.length];
          return (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              className="relative w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08] sm:w-auto"
            >
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c, boxShadow: `0 0 12px ${c}` }} />
              <span className="font-hud text-[10px] font-bold" style={{ color: c }}>
                ROUTE {i + 1} · [{i + 1}]
              </span>
              <span className="mt-0.5 block text-[15px] font-bold text-white">{o.label}</span>
              {o.stat && <span className="mt-0.5 block text-[11px] text-white/55">📊 {o.stat.text}</span>}
            </button>
          );
        })}
      </div>
      <button onClick={onAdd} className="mt-3 text-[13px] text-cyan-200/70 underline decoration-dotted underline-offset-4 hover:text-cyan-100">
        ✍️ 이 시점에 내 고민 추가하기 — AI가 새 갈림길을 만들어요
      </button>
    </div>
  );
}

export function ResultPanel({ onEnd }: { onEnd: () => void }) {
  const { path, custom, profile, scenes, setScene, goNext, setLoading } = usePlanet();
  const m = useMemo(() => nodeMap(custom), [custom]);
  const step = path[path.length - 1];
  const node = m.get(step.nodeId)!;
  const option = optionOf(m, step);
  const key = sig(path);
  const [by, setBy] = useState<'ai' | 'mock' | null>(null);
  const scene = scenes[key];

  useEffect(() => {
    if (scene || !option) return;
    let alive = true;
    const history = path.map((s) => optionOf(m, s)?.label).filter(Boolean) as string[];
    fetchScene({ profile, node, option, history, ai: true }).then((r) => {
      if (!alive) return;
      setBy(r.by);
      setScene(key, r.text);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!option) return null;
  const nexts = [...new Set(option.next)];
  const idx = node.options.findIndex((o) => o.id === option.id);
  const c = NEON[idx % NEON.length];

  return (
    <div className="animate-rise">
      <p className="text-[13px] text-white/50">{node.emoji} {node.question}</p>
      <h2 className="font-display text-2xl text-white sm:text-3xl" style={{ textShadow: `0 0 18px ${c}88` }}>
        → {option.label}
      </h2>
      {option.gives && option.gives.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="hud-label">Get</span>
          {option.gives.map((g) => (
            <span key={g} className="animate-rise rounded-md border border-cyan-300/40 bg-cyan-300/15 px-2 py-0.5 text-[12px] font-bold text-cyan-100 shadow-[0_0_12px_rgba(79,240,255,0.35)]">
              {TAG_LABEL[g] ?? g} 획득
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.25fr]">
        <div className="space-y-2.5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="hud-label mb-1.5">Data</div>
            {option.stat ? (
              <ul>
                <StatLine strong s={option.stat} />
              </ul>
            ) : (
              <p className="text-[13px] text-white/50">{node.custom ? '직접 추가한 갈림길이라 통계 근거가 없어요.' : '이 선택지만의 통계는 없어요. 질문의 통계를 참고하세요.'}</p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="hud-label">Gain / Loss</span>
              <span className="rounded bg-white/10 px-1.5 text-[10px] text-white/60">해석</span>
            </div>
            <ul className="space-y-0.5 text-[13px]">
              {option.gains.map((g) => (
                <li key={g} className="text-emerald-200">＋ {g}</li>
              ))}
              {option.costs.map((x) => (
                <li key={x} className="text-rose-200">－ {x}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: `${c}66`, background: `linear-gradient(135deg, ${c}14, rgba(15,18,40,0.6))` }}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="hud-label">1 Year Later · {NEXT_AGE[node.stage]}</span>
            <span className="rounded bg-white/10 px-1.5 text-[10px] text-white/60">{by === 'ai' ? 'AI 서술' : '예시 장면'}</span>
          </div>
          {scene ? <p className="text-[16px] leading-relaxed text-white/90">{scene}</p> : <p className="animate-blink text-white/50">장면을 불러오는 중…</p>}
        </div>
      </div>

      {node.custom?.kind === 'main' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {answeredCount(path) >= AI_STEPS ? (
            <button onClick={() => { goNext(null); onEnd(); }} className="neon-btn">
              🏁 10개의 갈림길 완주 · AI 진로 분석 받기
            </button>
          ) : (
            <>
              <button onClick={() => setLoading()} className="neon-btn">
                다음 갈림길로 →
              </button>
              <span className="text-[11px] text-white/45">AI가 지금까지의 선택을 보고 다음 분기점을 준비하고 있어요 · {answeredCount(path)}/{AI_STEPS}</span>
            </>
          )}
        </div>
      ) : (
      <div className="mt-4 flex flex-wrap gap-2">
        {nexts.length === 0 && (
          <button onClick={() => { goNext(null); onEnd(); }} className="neon-btn">
            🏁 20대 지도 완성 · 리포트
          </button>
        )}
        {nexts.map((id) => {
          const n = m.get(id);
          if (!n) return null;
          const label = node.custom ? `↩ 원래 질문으로 (${n.short})` : nexts.length > 1 ? DATA.outcomeLabels[id] ?? `→ ${n.short}` : `다음 갈림길 · ${n.emoji} ${n.short} →`;
          return (
            <button key={id} onClick={() => goNext(id)} className={nexts.length > 1 ? 'ghost-btn' : 'neon-btn'}>
              {label}
            </button>
          );
        })}
      </div>
      )}
      {nexts.length > 1 && !node.custom && <p className="mt-1.5 text-[11px] text-white/45">결과가 갈리는 선택이에요. 한쪽을 살아본 뒤, 지도에서 돌아와 다른 쪽도 체험할 수 있어요.</p>}
    </div>
  );
}
