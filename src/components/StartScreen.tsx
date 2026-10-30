import { Suspense, lazy, useState } from 'react';
import { usePlanet } from '../store';
import type { Field, Grade } from '../lib/types';

const Globe = lazy(() => import('./Globe').then((m) => ({ default: m.Globe })));

const FIELDS: Field[] = ['공학', '자연', '인문', '사회', '예체능', '의약', '교육'];
const GRADES: { v: Grade; label: string; hint: string }[] = [
  { v: 'low', label: '1·2학년', hint: '전공 고민부터' },
  { v: '3', label: '3학년', hint: '휴학 고민부터' },
  { v: '4', label: '4학년', hint: '졸업 후 고민부터' },
  { v: 'grad', label: '졸업생', hint: '졸업 후 고민부터' },
];
const INTERESTS = ['개발', '데이터·AI', '디자인', '기획', '공공·행정', '연구', '창업', '해외', '금융', '교육', '콘텐츠', '의료'];

const chip = (on: boolean) =>
  `rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${on ? 'border-cyan-300/70 bg-cyan-300/15 text-white shadow-[0_0_16px_rgba(79,240,255,0.35)]' : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'}`;

export function StartScreen() {
  const start = usePlanet((s) => s.start);
  const [name, setName] = useState('');
  const [field, setField] = useState<Field>('공학');
  const [grade, setGrade] = useState<Grade>('low');
  const [interests, setInterests] = useState<string[]>([]);
  const toggle = (t: string) => setInterests((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length >= 3 ? [...p.slice(1), t] : [...p, t]));

  return (
    <div className="space-bg relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <Suspense fallback={null}>
          <Globe onPick={() => {}} intro />
        </Suspense>
      </div>
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center px-4 py-10">
        <div className="text-center">
          <p className="hud-label">IF · 20s FORK PLANET</p>
          <h1 className="mt-2 font-display text-5xl text-white text-glow sm:text-6xl">갈림길 행성</h1>
          <p className="mt-3 text-base text-white/80">20대의 분기점, 정보로 읽지 말고 미리 살아보세요.</p>
          <p className="mt-1 text-xs text-white/45">모든 기본 갈림길은 통계청·교육부·한국고용정보원 공개 통계가 근거예요.</p>
        </div>

        <form
          className="glass-strong mt-7 space-y-5 rounded-3xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start({ name: name.trim().slice(0, 10), field, grade, interests });
          }}
        >
          <label className="block">
            <span className="hud-label">Name</span>
            <input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} placeholder="이름 (선택)" className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60" />
          </label>
          <div>
            <span className="hud-label">Major</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {FIELDS.map((f) => (
                <button type="button" key={f} onClick={() => setField(f)} className={chip(field === f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="hud-label">Now</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map((g) => (
                <button type="button" key={g.v} onClick={() => setGrade(g.v)} className={`${chip(grade === g.v)} text-center`}>
                  <div>{g.label}</div>
                  <div className="text-[10px] font-normal text-white/45">{g.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="hud-label">Interest · 최대 3</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {INTERESTS.map((t) => (
                <button type="button" key={t} onClick={() => toggle(t)} className={chip(interests.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="neon-btn w-full text-lg">
            행성에 착륙하기 🪐
          </button>
        </form>
      </div>
    </div>
  );
}
