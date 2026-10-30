import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { QuestionPanel, ResultPanel } from './components/Panels';
import { MindMap } from './components/MindMap';
import { AddQuestionModal, EndingReport } from './components/Modals';
import { nodeMap } from './lib/graph';
import { AGE } from './data/scenes';
import { usePlanet } from './store';
import { LiveDestinations } from './components/Destinations';
import { AiTimeline } from './components/AiTimeline';
import { useAiEngine } from './lib/useAiEngine';

const Globe = lazy(() => import('./components/Globe').then((m) => ({ default: m.Globe })));

export default function App() {
  const { profile, path, phase, custom, choose, reset, routes, mode } = usePlanet();
  useAiEngine();
  const [adding, setAdding] = useState(false);
  const [report, setReport] = useState(false);
  const [mapOpen, setMapOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [sheet, setSheet] = useState(true);
  const [askReset, setAskReset] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const m = useMemo(() => nodeMap(custom), [custom]);
  const pick = useCallback((id: string) => choose(id), [choose]);
  const node = path.length ? m.get(path[path.length - 1].nodeId) : undefined;

  useEffect(() => {
    if (profile && path.length && !node) reset();
    if (profile && !path.length && phase !== 'loading') usePlanet.getState().setLoading();
  }, [profile, path.length, node, reset]);
  useEffect(() => {
    if (phase !== 'moving') setSheet(true);
    // 새 질문·결과가 뜨면 패널을 맨 위(질문 제목)부터 보이게
    panelRef.current?.scrollTo({ top: 0 });
  }, [phase, path.length]);

  if (!profile) return <StartScreen />;
  const firstLoading = !path.length;
  const stage = node?.stage ?? 'S1';

  return (
    <div className="space-bg relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0 isolate">
        <Suspense fallback={<div className="grid h-full place-items-center font-hud text-cyan-200/70">LOADING PLANET…</div>}>
          <Globe onPick={pick} leftOpen={mapOpen} />
        </Suspense>
      </div>

      {/* 상단 HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="glass pointer-events-auto rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5">
          <p className="hud-label">20s Fork Planet</p>
          <p className="font-display text-xl leading-tight text-white text-glow">갈림길 행성</p>
          <p className="mt-0.5 hidden text-[11px] text-white/60 sm:block">
            {profile.name || '나'} · {profile.field}계열{profile.interests.length ? ` · ${profile.interests.join(', ')}` : ''} · <span className="text-cyan-200">{AGE[stage]}</span>
          </p>
        </div>
        <div className="pointer-events-auto flex gap-1.5">
          <button onClick={() => setMapOpen((v) => !v)} className="glass whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-bold text-white/90 hover:border-white/30">🗺 지도</button>
          <button onClick={() => setReport(true)} className="glass whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-bold text-white/90 hover:border-white/30">📜 리포트{routes.length ? ` ${routes.length}` : ''}</button>
          <button onClick={() => setAskReset(true)} className="glass whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-bold text-white/80 hover:border-white/30" aria-label="처음부터">↺ 처음부터</button>
        </div>
      </div>

      {/* 갈림길 지도·추천 (넓은 화면에서 왼쪽 유리 패널) */}
      {mapOpen && (
        <aside className="glass absolute left-3 top-[118px] z-20 hidden max-h-[calc(100dvh-134px)] w-[320px] overflow-y-auto rounded-3xl p-4 lg:block">
          <LiveDestinations />
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="hud-label">{mode === 'ai' ? 'AI Fork Log' : 'Fork Map'}</p>
            <h3 className="font-display text-lg text-white">{mode === 'ai' ? 'AI가 만든 갈림길' : '갈림길 지도'}</h3>
            <p className="mb-1 text-[11px] text-white/45">{mode === 'ai' ? '내 선택에 따라 AI가 다음 분기점을 만들어요' : '공개 통계로 만든 20대 분기점 전체'}</p>
            {mode === 'ai' ? <AiTimeline /> : <MindMap />}
          </div>
        </aside>
      )}
      {mapOpen && (
        <div className="fixed inset-0 z-[900] bg-slate-950/60 lg:hidden" onClick={() => setMapOpen(false)}>
          <div className="glass-strong absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-lg text-white">🗺 갈림길 지도</h3>
              <button onClick={() => setMapOpen(false)} className="text-xl text-white/60">✕</button>
            </div>
            {mode === 'ai' ? <AiTimeline onRewind={() => setMapOpen(false)} /> : <MindMap onRewind={() => setMapOpen(false)} />}
            <div className="mt-4 border-t border-white/10 pt-3">
              <LiveDestinations />
            </div>
          </div>
        </div>
      )}

      {/* 질문/결과 패널: 넓은 화면은 오른쪽 세로 패널, 좁은 화면은 아래 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 lg:inset-x-auto lg:bottom-3 lg:right-3 lg:top-[70px] lg:flex lg:w-[436px] lg:flex-col lg:justify-center lg:p-0">
        <div className="mx-auto w-full max-w-4xl lg:max-h-full">
          {phase === 'loading' ? (
            <div className="glass pointer-events-auto mx-auto w-fit rounded-2xl px-5 py-3 text-center">
              <p className="hud-label">AI Generating</p>
              <p className="animate-blink text-white">{firstLoading ? '🤖 AI가 당신의 첫 갈림길을 만드는 중…' : '🤖 지금까지의 선택을 보고 다음 갈림길을 만드는 중…'}</p>
            </div>
          ) : phase === 'moving' ? (
            <div className="glass pointer-events-auto mx-auto w-fit rounded-2xl px-5 py-3">
              <p className="hud-label">Walking</p>
              <p className="animate-blink text-white">갈림길을 따라 걸어가는 중…</p>
            </div>
          ) : (
            <div className="pointer-events-auto rounded-3xl border border-white/12 bg-slate-950/60 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <button onClick={() => setSheet((v) => !v)} className="flex w-full items-center justify-center py-1.5 text-white/40 hover:text-white/80" aria-label="패널 접기">
                <span className="h-1 w-10 rounded-full bg-white/25" />
              </button>
              {sheet && (
                <div ref={panelRef} className="max-h-[34vh] overflow-y-auto lg:max-h-[calc(100dvh-130px)] px-4 pb-3 [scrollbar-width:thin] sm:px-5">
                  {phase === 'question' && node && <QuestionPanel node={node} onPick={pick} onAdd={() => setAdding(true)} />}
                  {(phase === 'result' || phase === 'ended') && node && <ResultPanel onEnd={() => setReport(true)} />}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {adding && node && <AddQuestionModal parent={node} onClose={() => setAdding(false)} />}
      {report && <EndingReport onClose={() => setReport(false)} />}
      {askReset && (
        <div className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={() => setAskReset(false)} role="dialog" aria-modal="true">
          <div className="glass-strong w-full max-w-sm animate-rise rounded-3xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="hud-label">Restart</p>
            <h2 className="mt-1 font-display text-2xl text-white">처음부터 다시 할까요?</h2>
            <p className="mt-2 text-[13px] text-white/60">지나온 길과 루트 기록이 모두 지워지고 시작 화면으로 돌아가요.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setAskReset(false)} className="ghost-btn">취소</button>
              <button
                onClick={() => {
                  setAskReset(false);
                  setReport(false);
                  setAdding(false);
                  reset();
                }}
                className="neon-btn"
              >
                처음부터 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
