// 갈림길 행성 3D 월드 (메타버스 스타일)
// - 아바타는 행성 꼭대기에 서 있고, 카메라는 위에서 비스듬히 내려다본다(정수리가 보이게, 화면 중간보다 아래)
// - 질문마다 아바타 앞쪽 행성 표면에 갈림길 포털이 생긴다
// - 고르면 행성이 굴러가며 그 포털이 아바타 발밑으로 온다 = 아바타가 그 길로 걸어간다
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls, Sparkles, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { R, STEP_ANGLE, arc, dirOf, heading, nodeMap, walk } from '../lib/graph';
import { usePlanet } from '../store';
import type { ForkNode, Option } from '../lib/types';
import { Atmosphere, Orbiters, PlanetBody } from './world/PlanetDecor';
import { Character } from './world/Explorer';

const UP = new THREE.Vector3(0, 1, 0);
export const NEON = ['#4FF0FF', '#FF5FA2', '#FFD166', '#8F7BFF', '#5CFF9D', '#FF9F43', '#5AA9FF'];

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 아바타 ---------- */
function Avatar({ color = '#4FF0FF' }: { color?: string }) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    const b = body.current;
    if (!g || !b) return;
    const st = usePlanet.getState();
    const t = clock.elapsedTime;
    const moving = st.phase === 'moving';
    // 바라보는 방향: 걷는 중엔 갈림길 방향, 평소엔 카메라 쪽으로 살짝 흔들
    let targetY = Math.sin(t * 0.6) * 0.35;
    if (moving) {
      const m = nodeMap(st.custom);
      const last = st.path[st.path.length - 1];
      const n = last && m.get(last.nodeId);
      const i = n ? n.options.findIndex((o) => o.id === last.optionId) : -1;
      if (n && i >= 0) {
        const d = dirOf(heading(i, n.options.length));
        targetY = Math.atan2(d.x, d.z);
      }
    }
    let diff = targetY - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * (moving ? 10 : 3));
    b.position.y = moving ? Math.abs(Math.sin(t * 11)) * 0.09 : Math.sin(t * 2.2) * 0.03;
    b.rotation.z = moving ? Math.sin(t * 11) * 0.08 : 0;
  });
  return (
    <group ref={ref} position={[0, R, 0]} scale={0.68}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.32, 0.42, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <group ref={body}>
        <Character />
      </group>
      <pointLight position={[0, 0.8, 0.6]} color={color} intensity={1.2} distance={3} />
    </group>
  );
}

/* ---------- 지나온 지점 비콘 ---------- */
function Beacon({ p, color, label }: { p: THREE.Vector3; color: string; label?: string }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, p.clone().normalize()), [p]);
  return (
    <group position={p.clone().normalize().multiplyScalar(R * 1.004)} quaternion={q}>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.025, 0.05, 0.44, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.08, 0.13, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {label && (
        <Html position={[0, 0.6, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-lg border border-white/15 bg-slate-950/70 px-2 py-0.5 text-[11px] font-bold text-white/90 backdrop-blur">{label}</div>
        </Html>
      )}
    </group>
  );
}

/* ---------- 갈림길 포털 (행성 위 로컬 좌표) ---------- */
interface Fork {
  o: Option;
  i: number;
  color: string;
  path: THREE.Vector3[];
  end: THREE.Vector3;
  q: THREE.Quaternion;
}

function Portal({ f, chosen, dim, onPick }: { f: Fork; chosen: boolean; dim: boolean; onPick: (id: string) => void }) {
  const ring = useRef<THREE.Mesh>(null);
  const holder = useRef<THREE.Group>(null);
  const face = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame(({ clock }, dt) => {
    if (ring.current) ring.current.rotation.z += dt * (hover || chosen ? 2.6 : 0.9);
    const h = holder.current;
    if (h) {
      const s = dim ? 0.001 : hover ? 1.15 : chosen ? 0.85 : 1;
      target.set(s, s, s);
      h.scale.lerp(target, Math.min(1, dt * 8));
      h.position.y = 0.42 + Math.sin(clock.elapsedTime * 1.4 + f.i) * 0.04;
    }
    if (face.current) face.current.lookAt(camera.position);
  });
  return (
    <group position={f.end} quaternion={f.q}>
      <group ref={holder} position={[0, 0.42, 0]}>
        <group ref={face}>
          <mesh
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (!dim && !chosen) onPick(f.o.id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(true);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHover(false);
              document.body.style.cursor = 'default';
            }}
          >
            <circleGeometry args={[0.36, 32]} />
            <meshBasicMaterial color={f.color} transparent opacity={hover ? 0.35 : 0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={ring}>
            <torusGeometry args={[0.32, 0.026, 12, 64, Math.PI * 1.7]} />
            <meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.38, 0.007, 6, 64]} />
            <meshBasicMaterial color={f.color} transparent opacity={0.7} toneMapped={false} />
          </mesh>
        </group>
        {!dim && !chosen && (
          <Html position={[0, 0.62, 0]} center zIndexRange={[40, 20]}>
            <button
              onClick={() => onPick(f.o.id)}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              className={`w-[136px] rounded-xl border px-2 py-1 text-center backdrop-blur-md transition ${hover ? 'border-white/50 bg-slate-950/90' : 'border-white/15 bg-slate-950/65'}`}
              style={{ boxShadow: `0 0 18px ${f.color}55` }}
            >
              <span className="block font-hud text-[10px] font-bold" style={{ color: f.color }}>
                ROUTE {f.i + 1}
              </span>
              <span className="block truncate text-[12.5px] font-bold text-white">{f.o.label}</span>
              {f.o.stat && <span className="block truncate text-[10px] text-white/55">{f.o.stat.text}</span>}
            </button>
          </Html>
        )}
      </group>
    </group>
  );
}

function makeForks(node: ForkNode, q: THREE.Quaternion): Fork[] {
  const inv = q.clone().invert();
  return node.options.map((o, i) => {
    const d = dirOf(heading(i, node.options.length));
    const world: THREE.Vector3[] = [];
    for (let k = 0; k <= 20; k++) {
      const t = 0.05 + (k / 20) * (STEP_ANGLE - 0.05);
      world.push(UP.clone().multiplyScalar(Math.cos(t)).add(d.clone().multiplyScalar(Math.sin(t))).multiplyScalar(R * 1.012));
    }
    const path = world.map((v) => v.clone().applyQuaternion(inv));
    const end = path[path.length - 1].clone();
    return { o, i, color: NEON[i % NEON.length], path, end, q: new THREE.Quaternion().setFromUnitVectors(UP, end.clone().normalize()) };
  });
}

/* ---------- 씬 ---------- */
function Scene({ onPick, intro }: { onPick: (id: string) => void; intro?: boolean }) {
  const { path, routes, custom, phase, arrived } = usePlanet();
  const m = useMemo(() => nodeMap(custom), [custom]);
  const cur = useMemo(() => walk(m, path), [m, path]);
  const { camera, size } = useThree();

  // 카메라: 위에서 비스듬히 → 아바타가 화면 중간보다 아래, 정수리가 보임
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const k = aspect < 0.8 ? 1.9 : aspect < 1.3 ? 1.35 : 1.04;
    camera.position.set(0, R + 6.2 * k, 3.8 * k);
    camera.lookAt(0, R - 1.05, -0.1);
  }, [camera, size.width, size.height]);

  const planet = useRef<THREE.Group>(null);
  const tween = useRef<{ from: THREE.Quaternion; to: THREE.Quaternion; t0: number; dur: number } | null>(null);
  const clock = useRef(0);

  useEffect(() => {
    const g = planet.current;
    if (!g) return;
    tween.current = { from: g.quaternion.clone(), to: cur.q.clone(), t0: clock.current, dur: usePlanet.getState().phase === 'moving' ? 1.8 : 1.0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.q.x, cur.q.y, cur.q.z, cur.q.w]);

  // 질문·결과 패널이 화면 아래를 덮는 만큼, 렌더 중심을 위로 올려 행성이 패널 위에 보이게
  const shift = useRef(0);
  useFrame((_, dt) => {
    const ph = usePlanet.getState().phase;
    const target = intro ? 0 : ph === 'question' || ph === 'result' || ph === 'ended' ? (size.width < 700 ? 0.05 : size.height < 900 ? 0.075 : 0.1) : 0.04;
    const prev = shift.current;
    shift.current += (target - shift.current) * Math.min(1, dt * 3);
    if (Math.abs(prev - shift.current) > 0.0004 || !(camera as THREE.PerspectiveCamera).view) {
      (camera as THREE.PerspectiveCamera).setViewOffset(size.width, size.height, 0, size.height * shift.current, size.width, size.height);
    }
  });

  useFrame((_, dt) => {
    clock.current += dt;
    const g = planet.current;
    const tw = tween.current;
    if (intro && g) {
      g.rotation.x += dt * 0.08;
      return;
    }
    if (g && tw) {
      const k = Math.min(1, (clock.current - tw.t0) / tw.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      g.quaternion.slerpQuaternions(tw.from, tw.to, e);
      if (k >= 1) {
        tween.current = null;
        if (usePlanet.getState().phase === 'moving') arrived();
      }
    } else if (usePlanet.getState().phase === 'moving') arrived();
  });

  // 질문 시점의 포털 (선택 후 행성이 굴러가도 같은 포털이 따라 움직이도록 로컬 좌표로 고정)
  const forksRef = useRef<{ key: string; forks: Fork[] }>({ key: '', forks: [] });
  const last = path[path.length - 1];
  const node = last ? m.get(last.nodeId) : undefined;
  if (node && phase === 'question') {
    const key = `${node.id}:${node.options.length}:${cur.q.x.toFixed(4)}:${cur.q.y.toFixed(4)}:${cur.q.z.toFixed(4)}:${cur.q.w.toFixed(4)}`;
    if (forksRef.current.key !== key) forksRef.current = { key, forks: makeForks(node, cur.q) };
  }
  const showForks = phase === 'question' || phase === 'moving';
  const chosenId = phase === 'moving' ? last?.optionId : undefined;

  const others = useMemo(() => routes.map((r) => ({ r, pts: walk(m, r.steps).pts })), [routes, m]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 9, 6]} intensity={1.3} color="#DDE3FF" />
      <directionalLight position={[-8, -2, -6]} intensity={0.6} color="#B388FF" />
      <Stars radius={70} depth={45} count={3500} factor={3.2} saturation={0.6} fade speed={0.6} />
      <Sparkles count={60} scale={[10, 4, 10]} position={[0, R + 1, -1]} size={2.2} speed={0.35} color="#9FB4FF" opacity={0.6} />
      <Atmosphere />
      <Orbiters />

      <group ref={planet}>
        <PlanetBody />
        {others.map(({ r, pts }) =>
          pts.slice(1).map((p, i) => <Line key={`${r.id}-${i}`} points={arc(pts[i], p, 1.008)} color={r.color} lineWidth={2.5} transparent opacity={0.6} toneMapped={false} />),
        )}
        {cur.pts.slice(1).map((p, i) => (
          <Line key={`cur-${i}`} points={arc(cur.pts[i], p, 1.01)} color="#4FF0FF" lineWidth={4} toneMapped={false} />
        ))}
        {cur.pts.slice(0, -1).map((p, i) => {
          const n = m.get(path[i]?.nodeId);
          return <Beacon key={`b-${i}`} p={p} color={n?.custom ? '#FFD166' : '#4FF0FF'} label={n ? `${n.emoji} ${n.short}` : undefined} />;
        })}
        {showForks &&
          forksRef.current.forks.map((f) => {
            const dim = !!chosenId && f.o.id !== chosenId;
            return (
              <group key={f.o.id}>
                {!dim && <Line points={f.path} color={f.color} lineWidth={chosenId ? 5 : 3} dashed={!chosenId} dashSize={0.12} gapSize={0.07} toneMapped={false} />}
                <Portal f={f} chosen={f.o.id === chosenId} dim={dim} onPick={onPick} />
              </group>
            );
          })}
      </group>

      <Avatar />

      <OrbitControls
        target={[0, R - 1.05, -0.1]}
        enabled={!intro}
        enablePan={false}
        enableZoom
        minDistance={4}
        maxDistance={16}
        minPolarAngle={0.25}
        maxPolarAngle={1.2}
        minAzimuthAngle={-0.8}
        maxAzimuthAngle={0.8}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
      />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.85} luminanceThreshold={0.3} luminanceSmoothing={0.35} mipmapBlur />
        <Vignette darkness={0.55} offset={0.25} />
      </EffectComposer>
    </>
  );
}

export function Globe({ onPick, intro }: { onPick: (optionId: string) => void; intro?: boolean }) {
  return (
    <Canvas camera={{ position: [0, R + 6.2, 3.8], fov: 45 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Suspense fallback={null}>
        <Scene onPick={onPick} intro={intro} />
      </Suspense>
    </Canvas>
  );
}
