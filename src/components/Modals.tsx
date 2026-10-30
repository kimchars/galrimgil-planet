import { useMemo, useState } from 'react';
import { fetchBranch } from '../lib/api';
import { BASE_NODES, nodeMap, optionOf } from '../lib/graph';
import { usePlanet } from '../store';
import { DestinationCards } from './Destinations';
import type { ForkNode } from '../lib/types';

function Shell({ title, label, onClose, children }: { title: string; label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="glass-strong max-h-[90vh] w-full max-w-4xl animate-rise overflow-y-auto rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="hud-label">{label}</p>
            <h2 className="mt-1 font-display text-2xl text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="px-2 text-xl text-white/60 hover:text-white" aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AddQuestionModal({ parent, onClose }: { parent: ForkNode; onClose: () => void }) {
  const { profile, addCustom } = usePlanet();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (q.trim().length < 2 || busy) return;
    setBusy(true);
    const node = await fetchBranch({ question: q.trim(), profile, parent, ai: true });
    addCustom(node);
    setBusy(false);
    onClose();
  };
  return (
    <Shell label="Custom Fork" title="✍️ 이 시점에 내 고민 추가" onClose={onClose}>
      <p className="text-[13px] text-white/60">
        지금 질문(<b className="text-white/85">{parent.question}</b>) 앞에 나만의 분기점을 끼워 넣어요. AI가 갈림길을 만들고, 답을 고르면 원래 질문으로 돌아와요. 이 갈림길은 통계 근거가 없다고 표시돼요.
      </p>
      <input
        autoFocus
        value={q}
        maxLength={50}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="예: 교환학생 갈까, 코딩 부트캠프 들어갈까?"
        className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {['교환학생 갈까 말까?', '워홀 갈까, 바로 취업할까?', '코딩 부트캠프 들어갈까 말까?'].map((ex) => (
          <button key={ex} onClick={() => setQ(ex)} className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-[12px] text-white/70 hover:border-white/30">
            {ex}
          </button>
        ))}
      </div>
      <button onClick={submit} disabled={q.trim().length < 2 || busy} className="neon-btn mt-4 w-full">
        {busy ? '갈림길 생성 중…' : '갈림길 만들기 ✨'}
      </button>
    </Shell>
  );
}

export function EndingReport({ onClose }: { onClose: () => void }) {
  const { routes, path, custom, profile, reset, rewind } = usePlanet();
  const jump = (nodeId: string) => {
    const idx = path.map((s) => s.nodeId).lastIndexOf(nodeId);
    if (idx >= 0) {
      rewind(idx);
      onClose();
    }
  };
  const m = useMemo(() => nodeMap(custom), [custom]);
  const all = routes.length ? routes : [{ id: 'cur', color: '#4FF0FF', steps: path.filter((s) => s.optionId), ended: false }];
  const seen = new Set(all.flatMap((r) => r.steps.map((s) => s.nodeId)));
  const statCount = all.flatMap((r) => r.steps).reduce((a, s) => a + (m.get(s.nodeId)?.stats.length ?? 0), 0);
  const unvisited = BASE_NODES.filter((n) => !seen.has(n.id));

  return (
    <Shell label="Report" title={`🗺 ${profile?.name ? `${profile.name}의 ` : '나의 '}20대 갈림길 지도`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [all.length, '살아본 루트', '#4FF0FF'],
          [seen.size, '마주친 분기점', '#FF5FA2'],
          [statCount, '확인한 통계', '#FFD166'],
        ].map(([v, l, c]) => (
          <div key={l as string} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
            <div className="font-hud text-2xl font-bold" style={{ color: c as string, textShadow: `0 0 14px ${c}` }}>{v}</div>
            <div className="text-[11px] text-white/55">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <DestinationCards onJump={jump} />
      </div>

      <p className="hud-label mt-5">Routes</p>
      <div className={`mt-2 grid gap-3 ${all.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {all.map((r, i) => (
          <div key={r.id} className="rounded-2xl border bg-white/[0.03] p-3" style={{ borderColor: `${r.color}88`, boxShadow: `0 0 18px ${r.color}22` }}>
            <div className="mb-2 font-hud text-[12px] font-bold" style={{ color: r.color }}>
              ROUTE {i + 1} {r.ended && '· 🏁'}
            </div>
            <ol className="space-y-1.5 text-[13px]">
              {r.steps.map((s, k) => {
                const n = m.get(s.nodeId);
                const o = optionOf(m, s);
                return (
                  <li key={k} className="leading-snug text-white/85">
                    <span className="text-white/45">{n?.emoji} {n?.short}</span> → <b className="text-white">{o?.label}</b>
                    {o?.stat && <span className="block pl-5 text-[11px] text-white/45">📊 {o.stat.text}</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      {unvisited.length > 0 && (
        <div className="mt-4">
          <p className="hud-label">Unexplored · {unvisited.length}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unvisited.map((n) => (
              <span key={n.id} className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px] text-white/50">{n.emoji} {n.short}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={onClose} className="neon-btn">다른 길 더 살아보기</button>
        <button onClick={() => { reset(); onClose(); }} className="ghost-btn">처음부터</button>
      </div>
      <p className="mt-2 text-[11px] text-white/40">갈림길 지도에서 지나온 질문을 누르면 그 시점으로 돌아가요.</p>
    </Shell>
  );
}
