// 갈림이: 갈림길 행성의 오리지널 탐험가 — 은빛 눈표범 (머리 위 새싹 = 성장하는 진로)
// public/mascot.glb 파일이 있으면 그 3D 모델을 대신 쓴다 (권리가 있는 모델만 넣을 것)
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { usePlanet } from '../../store';

const FUR = '#C9D0E2';
const BELLY = '#E8ECF6';
const SPOT = '#2E3245';
const MINT = '#5CFFC8';
const ORANGE = '#FF9F43';
const PAW = '#C9D0E0';
const Z = new THREE.Vector3(0, 0, 1);

/** 구 표면에 붙는 로제트(고리 무늬)·점 무늬 */
function Spots({ c, r, dirs }: { c: [number, number, number]; r: number; dirs: [number, number, number, number, 'ring' | 'dot'][] }) {
  const items = useMemo(
    () =>
      dirs.map(([x, y, z, s, kind]) => {
        const d = new THREE.Vector3(x, y, z).normalize();
        return { p: new THREE.Vector3(...c).add(d.clone().multiplyScalar(r * 0.985)), q: new THREE.Quaternion().setFromUnitVectors(Z, d), s, kind };
      }),
    [c, r, dirs],
  );
  return (
    <>
      {items.map((it, i) =>
        it.kind === 'ring' ? (
          <mesh key={i} position={it.p} quaternion={it.q} scale={[it.s, it.s * 0.85, it.s]}>
            <torusGeometry args={[0.03, 0.011, 6, 16]} />
            <meshStandardMaterial color={SPOT} roughness={0.7} />
          </mesh>
        ) : (
          <mesh key={i} position={it.p} quaternion={it.q} scale={[it.s, it.s, it.s * 0.3]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshStandardMaterial color={SPOT} roughness={0.7} />
          </mesh>
        ),
      )}
    </>
  );
}

const HEAD_SPOTS: [number, number, number, number, 'ring' | 'dot'][] = [
  [0, 1, 0.05, 1.5, 'ring'], [-0.42, 0.88, -0.2, 1.4, 'ring'], [0.42, 0.88, -0.2, 1.4, 'ring'],
  [0, 0.75, -0.65, 1.5, 'ring'], [-0.5, 0.55, -0.65, 1.2, 'ring'], [0.5, 0.55, -0.65, 1.2, 'ring'],
  [-0.22, 0.92, 0.35, 1.1, 'dot'], [0.22, 0.92, 0.35, 1.1, 'dot'], [0, 0.85, 0.52, 1.1, 'dot'],
  [-0.12, 0.7, 0.7, 0.9, 'dot'], [0.12, 0.7, 0.7, 0.9, 'dot'],
  [-0.62, 0.62, 0.35, 1.2, 'dot'], [0.62, 0.62, 0.35, 1.2, 'dot'], [-0.9, 0.25, 0, 1.3, 'ring'], [0.9, 0.25, 0, 1.3, 'ring'],
  [-0.8, -0.05, 0.55, 1, 'dot'], [0.8, -0.05, 0.55, 1, 'dot'],
];
const BODY_SPOTS: [number, number, number, number, 'ring' | 'dot'][] = [
  [-0.7, 0.35, 0.35, 1.4, 'ring'], [0.7, 0.35, 0.35, 1.4, 'ring'], [-0.85, -0.25, 0.2, 1.3, 'ring'], [0.85, -0.25, 0.2, 1.3, 'ring'],
  [-0.55, 0.7, -0.3, 1.2, 'dot'], [0.55, 0.7, -0.3, 1.2, 'dot'], [-0.7, -0.5, -0.4, 1.1, 'dot'], [0.7, -0.5, -0.4, 1.1, 'dot'],
  [-0.45, 0.1, 0.85, 1, 'dot'], [0.45, 0.1, 0.85, 1, 'dot'],
];

function Explorer() {
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const sprout = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const ears = useRef<THREE.Group>(null);

  const tailCurve = useMemo(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.02, -0.14), new THREE.Vector3(0.16, 0.1, -0.24), new THREE.Vector3(0.26, 0.26, -0.22), new THREE.Vector3(0.25, 0.4, -0.12)]),
    [],
  );
  const tailRings = useMemo(() => [0.35, 0.55, 0.72, 0.88].map((t) => ({ p: tailCurve.getPoint(t), d: tailCurve.getTangent(t) })), [tailCurve]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const moving = usePlanet.getState().phase === 'moving';
    const swing = moving ? Math.sin(t * 11) * 0.7 : Math.sin(t * 1.6) * 0.08;
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.position.z = moving ? Math.sin(t * 11) * 0.05 : 0;
    if (legR.current) legR.current.position.z = moving ? -Math.sin(t * 11) * 0.05 : 0;
    if (sprout.current) sprout.current.rotation.z = Math.sin(t * 2.4) * 0.18;
    if (tail.current) tail.current.rotation.y = Math.sin(t * (moving ? 6 : 1.8)) * (moving ? 0.45 : 0.25);
    if (ears.current) ears.current.rotation.z = Math.sin(t * 0.9) > 0.97 ? 0.08 : 0;
    if (eyes.current) eyes.current.scale.y = Math.sin(t * 1.3) > 0.985 ? 0.15 : 1;
  });

  return (
    <group>
      {/* 발 */}
      <mesh ref={legL} position={[-0.09, 0.07, 0.02]} scale={[1, 0.7, 1.25]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={FUR} roughness={0.6} />
      </mesh>
      <mesh ref={legR} position={[0.09, 0.07, 0.02]} scale={[1, 0.7, 1.25]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={FUR} roughness={0.6} />
      </mesh>
      {/* 몸통 + 무늬 */}
      <mesh position={[0, 0.3, 0]} scale={[1, 0.95, 0.9]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color={FUR} roughness={0.6} />
      </mesh>
      <group scale={[1, 0.95, 0.9]} position={[0, 0.3, 0]}>
        <Spots c={[0, 0, 0]} r={0.22} dirs={BODY_SPOTS} />
      </group>
      <mesh position={[0, 0.27, 0.12]} scale={[1, 1.15, 0.6]}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial color={BELLY} roughness={0.6} />
      </mesh>
      {/* 굵고 긴 꼬리 (눈표범 특징) */}
      <group ref={tail} position={[0, 0.18, -0.17]}>
        <mesh>
          <tubeGeometry args={[tailCurve, 24, 0.052, 10, false]} />
          <meshStandardMaterial color={FUR} roughness={0.6} />
        </mesh>
        {tailRings.map((r, i) => (
          <mesh key={i} position={r.p} quaternion={new THREE.Quaternion().setFromUnitVectors(Z, r.d)}>
            <torusGeometry args={[0.052, 0.012, 6, 16]} />
            <meshStandardMaterial color={SPOT} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={tailCurve.getPoint(1)}>
          <sphereGeometry args={[0.055, 14, 14]} />
          <meshStandardMaterial color={SPOT} roughness={0.7} />
        </mesh>
      </group>
      {/* 목도리 */}
      <mesh position={[0, 0.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.04, 12, 32]} />
        <meshStandardMaterial color={MINT} roughness={0.4} />
      </mesh>
      <mesh position={[-0.08, 0.4, 0.13]} rotation={[0.3, 0, 0.3]}>
        <boxGeometry args={[0.06, 0.13, 0.03]} />
        <meshStandardMaterial color={MINT} roughness={0.4} />
      </mesh>
      {/* 팔 */}
      {[
        [armL, -0.22, 0.35],
        [armR, 0.22, -0.35],
      ].map(([ref, x, rz]) => (
        <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.38, 0]}>
          <mesh position={[0, -0.09, 0]} rotation={[0, 0, rz as number]}>
            <capsuleGeometry args={[0.048, 0.12, 6, 12]} />
            <meshStandardMaterial color={FUR} roughness={0.6} />
          </mesh>
          <mesh position={[(x as number) > 0 ? 0.05 : -0.05, -0.17, 0]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color={PAW} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* 배낭 */}
      <mesh position={[0, 0.34, -0.2]}>
        <boxGeometry args={[0.26, 0.26, 0.12]} />
        <meshStandardMaterial color={ORANGE} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.26, -0.27]}>
        <boxGeometry args={[0.18, 0.08, 0.04]} />
        <meshStandardMaterial color="#E07B1F" roughness={0.5} />
      </mesh>
      <mesh position={[-0.1, 0.51, -0.22]}>
        <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
        <meshBasicMaterial color="#C9CFFF" />
      </mesh>
      <mesh position={[-0.1, 0.6, -0.22]}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* 머리 + 무늬 */}
      <group position={[0, 0.76, 0]} rotation={[-0.45, 0, 0]}>
        <mesh scale={[1.08, 0.95, 1]}>
          <sphereGeometry args={[0.27, 40, 40]} />
          <meshStandardMaterial color={FUR} roughness={0.85} />
        </mesh>
        <group scale={[1.08, 0.95, 1]}>
          <Spots c={[0, 0, 0]} r={0.27} dirs={HEAD_SPOTS} />
        </group>
        {/* 둥근 귀 */}
        <group ref={ears}>
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * 0.2, 0.21, -0.02]} rotation={[0, 0, -sx * 0.4]} scale={1.3}>
              <mesh scale={[1, 0.9, 0.55]}>
                <sphereGeometry args={[0.075, 16, 16]} />
                <meshStandardMaterial color={SPOT} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.005, 0.02]} scale={[0.75, 0.7, 0.5]}>
                <sphereGeometry args={[0.075, 16, 16]} />
                <meshStandardMaterial color="#F4C9D4" roughness={0.6} />
              </mesh>
            </group>
          ))}
        </group>
        {/* 주둥이 */}
        <mesh position={[0, -0.08, 0.2]} scale={[1.25, 0.8, 0.8]}>
          <sphereGeometry args={[0.085, 20, 20]} />
          <meshStandardMaterial color={BELLY} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.04, 0.27]} scale={[1.2, 0.8, 0.8]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshStandardMaterial color="#F28AA0" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.1, 0.265]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.022, 0.006, 6, 16, Math.PI]} />
          <meshStandardMaterial color="#5A3346" />
        </mesh>
        {/* 수염 */}
        {[-1, 1].map((sx) =>
          [0, 1].map((k) => (
            <mesh key={`${sx}${k}`} position={[sx * 0.13, -0.07 - k * 0.025, 0.24]} rotation={[0, 0, sx * (0.1 - k * 0.2) + Math.PI / 2]}>
              <cylinderGeometry args={[0.002, 0.002, 0.1, 4]} />
              <meshBasicMaterial color="#9AA3BC" />
            </mesh>
          )),
        )}
        {/* 눈 (연청록 눈동자) */}
        <group ref={eyes} position={[0, 0.02, 0.235]}>
          {[-0.095, 0.095].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh scale={[1, 1.2, 0.5]}>
                <sphereGeometry args={[0.04, 16, 16]} />
                <meshStandardMaterial color="#1B1838" roughness={0.2} />
              </mesh>
              <mesh position={[0, -0.006, 0.012]} scale={[1, 1.2, 0.4]}>
                <sphereGeometry args={[0.026, 14, 14]} />
                <meshStandardMaterial color="#59D6C8" emissive="#59D6C8" emissiveIntensity={0.4} roughness={0.2} />
              </mesh>
              <mesh position={[0.012, 0.018, 0.022]}>
                <sphereGeometry args={[0.01, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
        {/* 볼 */}
        {[-0.17, 0.17].map((x) => (
          <mesh key={x} position={[x, -0.07, 0.19]} scale={[1, 0.6, 0.3]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#FFB3C4" roughness={0.6} />
          </mesh>
        ))}
        {/* 새싹 */}
        <group ref={sprout} position={[0, 0.25, -0.02]}>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.11, 8]} />
            <meshStandardMaterial color="#3FBF7F" />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.06, 0.11 + (sx > 0 ? 0.01 : 0), 0]} rotation={[0, 0, -sx * 0.6]} scale={[1, 0.45, 0.6]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={0.6} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function GlbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const fitted = useRef<THREE.Group>(null);
  useEffect(() => {
    // 모델 크기를 키 약 1.1로 맞추고 발을 바닥에
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = 1.1 / Math.max(0.0001, size.y);
    scene.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(scene);
    scene.position.y -= b2.min.y;
  }, [scene]);
  return (
    <group ref={fitted}>
      <primitive object={scene} />
    </group>
  );
}

/** public/mascot.glb 가 있으면 그 모델, 없으면 눈표범 갈림이 */
export function Character() {
  const [glb, setGlb] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('mascot.glb', { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') ?? '';
        if (alive && r.ok && !type.includes('text/html')) setGlb('mascot.glb');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!glb) return <Explorer />;
  return (
    <Suspense fallback={<Explorer />}>
      <GlbModel url={glb} />
    </Suspense>
  );
}
