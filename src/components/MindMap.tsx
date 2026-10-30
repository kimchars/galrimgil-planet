// 갈림길 지도 (네온 마인드맵)
import { useMemo } from 'react';
import { DATA, layout, nodeMap } from '../lib/graph';
import { usePlanet } from '../store';

export function MindMap({ onRewind }: { onRewind?: () => void }) {
  const { path, routes, custom, rewind, phase } = usePlanet();
  const m = useMemo(() => nodeMap(custom), [custom]);
  const L = useMemo(() => layout(m, DATA.start), [m]);
  const startId = path[0]?.nodeId;

  const curEdges = new Set<string>();
  for (let i = 1; i < path.length; i++) curEdges.add(`${path[i - 1].nodeId}>${path[i].nodeId}`);
  const visited = new Set(path.map((s) => s.nodeId));
  const routeEdges = routes.map((r) => {
    const s = new Set<string>();
    for (let i = 1; i < r.steps.length; i++) s.add(`${r.steps[i - 1].nodeId}>${r.steps[i].nodeId}`);
    return { color: r.color, s, nodes: new Set(r.steps.map((x) => x.nodeId)) };
  });
  const current = path[path.length - 1]?.nodeId;

  const jump = (id: string) => {
    const idx = path.map((s) => s.nodeId).lastIndexOf(id);
    if (idx >= 0 && idx < path.length - 1 && phase !== 'moving') {
      rewind(idx);
      onRewind?.();
    }
  };

  return (
    <div>
      <svg viewBox={`0 0 ${L.width} ${L.height}`} className="w-full" role="img" aria-label="갈림길 지도">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {L.edges.map((e) => {
          const a = L.pos[e.from];
          const b = L.pos[e.to];
          const k = `${e.from}>${e.to}`;
          const onCur = curEdges.has(k);
          const rc = routeEdges.find((r) => r.s.has(k))?.color;
          const cust = m.get(e.to)?.custom || m.get(e.from)?.custom;
          const midY = (a.y + b.y) / 2;
          const d = b.y > a.y ? `M${a.x},${a.y} C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}` : `M${a.x},${a.y} C${a.x + 60},${a.y} ${b.x + 60},${b.y} ${b.x},${b.y}`;
          return (
            <path
              key={k}
              d={d}
              fill="none"
              stroke={onCur ? '#4FF0FF' : rc ?? 'rgba(255,255,255,0.12)'}
              strokeWidth={onCur ? 3 : rc ? 2.5 : 1.2}
              strokeDasharray={cust ? '4 4' : undefined}
              filter={onCur || rc ? 'url(#glow)' : undefined}
            />
          );
        })}
        {[...m.values()].map((n) => {
          const p = L.pos[n.id];
          if (!p) return null;
          const isCur = n.id === current;
          const isVisited = visited.has(n.id);
          const rh = routeEdges.find((r) => r.nodes.has(n.id));
          const clickable = isVisited && !isCur;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={() => clickable && jump(n.id)} style={{ cursor: clickable ? 'pointer' : 'default' }}>
              {isCur && <circle r={17} fill="none" stroke="#4FF0FF" strokeWidth={2} className="animate-blink" filter="url(#glow)" />}
              <circle
                r={13}
                fill={isCur ? 'rgba(79,240,255,0.35)' : isVisited ? 'rgba(79,240,255,0.14)' : 'rgba(255,255,255,0.04)'}
                stroke={isCur || isVisited ? '#4FF0FF' : rh?.color ?? 'rgba(255,255,255,0.25)'}
                strokeWidth={isCur || isVisited ? 2 : 1.2}
                strokeDasharray={n.custom ? '3 3' : undefined}
              />
              <text textAnchor="middle" dy="5" fontSize="13">{n.emoji}</text>
              <text textAnchor="middle" y={27} fontSize="10.5" fontWeight={700} fill={isCur || isVisited ? '#E9ECFF' : 'rgba(233,236,255,0.45)'}>
                {n.short}
              </text>
              {n.id === startId && <text textAnchor="middle" y={-19} fontSize="8.5" fill="rgba(165,243,252,0.7)" style={{ fontFamily: 'Orbitron' }}>START</text>}
            </g>
          );
        })}
      </svg>
      {routes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {routes.map((r, i) => (
            <span key={r.id} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }} />
              루트 {i + 1} · {r.steps.length}걸음{r.ended ? ' 🏁' : ''}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-white/40">지나온 질문을 누르면 그 시점으로 돌아가 다른 길을 살아볼 수 있어요. 점선 = 직접 추가한 갈림길.</p>
    </div>
  );
}
