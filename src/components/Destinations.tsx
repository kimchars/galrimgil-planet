// 도착지: 실시간 규칙 점수(15개 직군) · 엔딩 AI 진로 분석 TOP 3
import { useEffect, useMemo, useState } from 'react';
import { fetchRecommend, type Recommendation } from '../lib/api';
import { DATA, nodeMap, optionOf } from '../lib/graph';
import { JOB_BY_ID, TAG_LABEL, fit, hasPostings, tagsOf, whereToGet, type JobFit } from '../lib/jobs';
import { sig, usePlanet } from '../store';
import type { Step } from '../lib/types';

const barColor = (s: number) => (s >= 75 ? '#5CFF9D' : s >= 45 ? '#FFD166' : '#FF5FA2');

export function useFits(steps?: Step[]) {
  const { path, custom, profile } = usePlanet();
  const st = steps ?? path.filter((s) => s.optionId);
  return useMemo(() => {
    const tags = tagsOf(st, custom, profile);
    return { tags, fits: fit(tags) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(st), custom, profile]);
}

export function Inventory({ tags, max = 8 }: { tags: Set<string>; max?: number }) {
  const list = [...tags].filter((t) => TAG_LABEL[t]);
  if (!list.length) return <p className="text-[11px] text-white/40">아직 모은 스펙이 없어요.</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, max).map((t) => (
        <span key={t} className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-cyan-100">
          {TAG_LABEL[t]}
        </span>
      ))}
      {list.length > max && <span className="text-[10.5px] text-white/50">+{list.length - max}</span>}
    </div>
  );
}

/** 오른쪽 패널: 지금 루트의 15개 직군 중 TOP 3 (규칙 점수, 실시간) */
export function LiveDestinations() {
  const { tags, fits } = useFits();
  return (
    <div>
      <p className="hud-label">Destination · Live</p>
      <h3 className="font-display text-lg text-white">지금 루트의 도착지</h3>
      <div className="mb-2 mt-1">
        <Inventory tags={tags} />
      </div>
      <ul className="space-y-1.5">
        {fits.slice(0, 3).map((f) => (
          <li key={f.job.id}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="truncate font-bold text-white/90">
                {f.job.emoji} {f.job.name}
              </span>
              <span className="font-hud text-[11px]" style={{ color: barColor(f.score) }}>{f.score}%</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${f.score}%`, background: barColor(f.score), boxShadow: `0 0 8px ${barColor(f.score)}` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10.5px] text-white/40">15개 직군의 요구조건 충족 비율(규칙 점수). 마지막엔 AI가 공고와 삶 전체를 보고 다시 판단해요.</p>
    </div>
  );
}

/* ---------- 엔딩: AI 진로 분석 ---------- */
const STEPS = ['살아온 10개의 선택 정리', '모은 스펙 태그 추출', '15개 직군 채용 요구와 비교', 'TOP 3 선정 · 근거 정리'];

function RuleFallbackCard({ f, rank, onJump }: { f: JobFit; rank: number; onJump: (nodeId: string) => void }) {
  const { path } = usePlanet();
  const c = barColor(f.score);
  return (
    <div className="rounded-2xl border bg-white/[0.03] p-3" style={{ borderColor: `${c}66` }}>
      <p className="font-hud text-[10px] font-bold" style={{ color: c }}>DESTINATION {rank + 1}</p>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[16px] font-bold text-white">{f.job.emoji} {f.job.name}</p>
        <p className="font-hud text-2xl font-bold" style={{ color: c, textShadow: `0 0 12px ${c}` }}>{f.score}%</p>
      </div>
      <p className="text-[11px] text-white/45">{f.job.group}</p>
      <ul className="mt-2 space-y-1 text-[12.5px]">
        {f.met.map((r) => <li key={r.label} className="text-emerald-200">✅ {r.label}</li>)}
        {f.miss.map((r) => {
          const w = whereToGet(r);
          const idx = w ? path.map((s) => s.nodeId).lastIndexOf(w.node.id) : -1;
          return (
            <li key={r.label} className="text-rose-200">
              ❌ {r.label}
              {w && idx >= 0 && (
                <button onClick={() => onJump(w.node.id)} className="ml-1.5 rounded-md border border-cyan-300/40 px-1.5 text-[10.5px] text-cyan-200 hover:bg-cyan-300/10">
                  돌아가서 채우기 ↩
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AiRecommendation({ onJump }: { onJump: (nodeId: string) => void }) {
  const { path, custom, profile } = usePlanet();
  const done = path.filter((s) => s.optionId);
  const key = sig(done);
  const { tags, fits } = useFits(done);
  const [rec, setRec] = useState<Recommendation | null | undefined>(undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setRec(undefined);
    setTick(0);
    const timer = setInterval(() => setTick((t) => Math.min(STEPS.length - 1, t + 1)), 900);
    const m = nodeMap(custom);
    const life = done.map((s) => ({ question: m.get(s.nodeId)?.question ?? '', choice: optionOf(m, s)?.label ?? '' }));
    const ruleScores = Object.fromEntries(fits.map((f) => [f.job.id, f.score]));
    fetchRecommend({ profile, life, tags: [...tags], ruleScores }).then((r) => {
      if (!alive) return;
      clearInterval(timer);
      setRec(r);
    });
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ruleOf = (id: string) => fits.find((f) => f.job.id === id)?.score ?? 0;

  return (
    <div>
      <p className="hud-label">AI Career Analysis</p>
      <h3 className="font-display text-xl text-white">AI가 본 나의 도착지 TOP 3</h3>
      <div className="mb-3 mt-1.5">
        <Inventory tags={tags} max={14} />
      </div>

      {rec === undefined && (
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/5 p-4">
          {STEPS.map((s, i) => (
            <p key={s} className={`text-[13px] ${i < tick ? 'text-cyan-200' : i === tick ? 'animate-blink text-white' : 'text-white/30'}`}>
              {i < tick ? '✓' : i === tick ? '◌' : '·'} {s}
            </p>
          ))}
        </div>
      )}

      {rec && (
        <>
          {rec.overall && <p className="mb-3 rounded-xl bg-white/[0.05] px-3 py-2 text-[14px] text-white/85">🤖 {rec.overall}</p>}
          <div className="grid gap-3 md:grid-cols-3">
            {rec.top.slice(0, 3).map((t, i) => {
              const job = JOB_BY_ID[t.jobId];
              if (!job) return null;
              const c = barColor(t.fit);
              return (
                <div key={t.jobId} className="rounded-2xl border bg-white/[0.03] p-3" style={{ borderColor: `${c}66`, boxShadow: i === 0 ? `0 0 24px ${c}33` : undefined }}>
                  <p className="font-hud text-[10px] font-bold" style={{ color: c }}>AI PICK {i + 1}</p>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[16px] font-bold leading-tight text-white">{job.emoji} {job.name}</p>
                    <p className="font-hud text-2xl font-bold" style={{ color: c, textShadow: `0 0 12px ${c}` }}>{t.fit}</p>
                  </div>
                  <p className="text-[11px] text-white/45">
                    {job.group} · 규칙 점수 {ruleOf(job.id)}% · {hasPostings(job) ? `공고 ${job.postings.length}건 반영` : '공고 반영 전'}
                  </p>
                  <p className="mt-2 text-[13px] text-white/85">{t.summary}</p>
                  <ul className="mt-2 space-y-0.5 text-[12px]">
                    {t.evidence.map((e) => (
                      <li key={e.text} className="text-white/70">
                        {e.from === 'posting' ? '📎' : '👣'} {e.text}
                      </li>
                    ))}
                  </ul>
                  {t.gaps.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[12px]">
                      {t.gaps.map((g) => <li key={g} className="text-rose-200">❌ {g}</li>)}
                    </ul>
                  )}
                  <div className="mt-2 rounded-xl bg-white/[0.05] p-2">
                    <p className="hud-label mb-0.5">Next Action</p>
                    <ol className="list-decimal space-y-0.5 pl-4 text-[12px] text-emerald-200">
                      {t.actions.map((a) => <li key={a}>{a}</li>)}
                    </ol>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10.5px] text-white/40">AI 점수는 선택의 흐름과 채용 요구(📎 공고 원문 · 👣 내 선택)를 함께 본 적합도예요. 합격 예측이 아니에요. 규칙 점수는 요구조건 충족 비율로 같이 보여줘요.</p>
        </>
      )}

      {rec === null && (
        <>
          <p className="mb-2 text-[12px] text-amber-200/80">AI 분석을 불러오지 못해서, 규칙 점수로 TOP 3를 보여줘요.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {fits.slice(0, 3).map((f, i) => <RuleFallbackCard key={f.job.id} f={f} rank={i} onJump={onJump} />)}
          </div>
        </>
      )}
      <p className="mt-1 text-[10px] text-white/30">근거 데이터: {Object.values(DATA.sources).length}개 공개 출처 · 15개 직군 요구조건</p>
    </div>
  );
}

/** 기존 이름 호환 */
export const DestinationCards = AiRecommendation;
