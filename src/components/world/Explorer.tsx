// 갈림이: 갈림길 행성의 오리지널 탐험가 캐릭터 (머리 위 새싹 = 성장하는 진로)
// public/mascot.glb 파일이 있으면 그 3D 모델을 대신 쓴다 (권리가 있는 모델만 넣을 것)
import { Suspense, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { usePlanet } from '../../store';

const SKIN = '#FFE7C2';
const BODY = '#FFF6E6';
const MINT = '#5CFFC8';
const ORANGE = '#FF9F43';
const SHOE = '#6C63FF';

function Explorer() {
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const sprout = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const moving = usePlanet.getState().phase === 'moving';
    const swing = moving ? Math.sin(t * 11) * 0.7 : Math.sin(t * 1.6) * 0.08;
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.position.z = moving ? Math.sin(t * 11) * 0.05 : 0;
    if (legR.current) legR.current.position.z = moving ? -Math.sin(t * 11) * 0.05 : 0;
    if (sprout.current) sprout.current.rotation.z = Math.sin(t * 2.4) * 0.18;
    // 깜빡임
    if (eyes.current) eyes.current.scale.y = Math.sin(t * 1.3) > 0.985 ? 0.15 : 1;
  });

  return (
    <group>
      {/* 다리 */}
      <mesh ref={legL} position={[-0.09, 0.07, 0]} scale={[1, 0.7, 1.25]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color={SHOE} roughness={0.5} />
      </mesh>
      <mesh ref={legR} position={[0.09, 0.07, 0]} scale={[1, 0.7, 1.25]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color={SHOE} roughness={0.5} />
      </mesh>
      {/* 몸통 */}
      <mesh position={[0, 0.3, 0]} scale={[1, 0.95, 0.9]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial color={BODY} roughness={0.55} />
      </mesh>
      {/* 배 별 무늬 */}
      <mesh position={[0, 0.3, 0.195]}>
        <circleGeometry args={[0.06, 5]} />
        <meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {/* 목도리 */}
      <mesh position={[0, 0.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.15, 0.04, 12, 32]} />
        <meshStandardMaterial color={MINT} roughness={0.4} />
      </mesh>
      <mesh position={[0.08, 0.4, 0.13]} rotation={[0.3, 0, -0.3]}>
        <boxGeometry args={[0.06, 0.13, 0.03]} />
        <meshStandardMaterial color={MINT} roughness={0.4} />
      </mesh>
      {/* 팔 */}
      <group ref={armL} position={[-0.22, 0.38, 0]}>
        <mesh position={[0, -0.09, 0]} rotation={[0, 0, 0.35]}>
          <capsuleGeometry args={[0.045, 0.12, 6, 12]} />
          <meshStandardMaterial color={BODY} roughness={0.55} />
        </mesh>
      </group>
      <group ref={armR} position={[0.22, 0.38, 0]}>
        <mesh position={[0, -0.09, 0]} rotation={[0, 0, -0.35]}>
          <capsuleGeometry args={[0.045, 0.12, 6, 12]} />
          <meshStandardMaterial color={BODY} roughness={0.55} />
        </mesh>
      </group>
      {/* 배낭 */}
      <mesh position={[0, 0.33, -0.2]}>
        <boxGeometry args={[0.26, 0.26, 0.12]} />
        <meshStandardMaterial color={ORANGE} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.25, -0.27]}>
        <boxGeometry args={[0.18, 0.08, 0.04]} />
        <meshStandardMaterial color="#E07B1F" roughness={0.5} />
      </mesh>
      <mesh position={[0.1, 0.5, -0.22]}>
        <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
        <meshBasicMaterial color="#C9CFFF" />
      </mesh>
      <mesh position={[0.1, 0.59, -0.22]}>
        <sphereGeometry args={[0.022, 10, 10]} />
        <meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.76, 0]}>
        <sphereGeometry args={[0.27, 40, 40]} />
        <meshStandardMaterial color={SKIN} roughness={0.5} />
      </mesh>
      {/* 고글 */}
      <mesh position={[0, 0.9, 0]} rotation={[0.25, 0, 0]}>
        <torusGeometry args={[0.262, 0.018, 8, 40]} />
        <meshStandardMaterial color="#3B3F7A" roughness={0.4} />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <group key={x} position={[x, 0.95, 0.19]} rotation={[-0.35, 0, 0]}>
          <mesh>
            <torusGeometry args={[0.055, 0.016, 8, 24]} />
            <meshStandardMaterial color="#3B3F7A" roughness={0.3} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.048, 20]} />
            <meshStandardMaterial color="#4FF0FF" emissive="#4FF0FF" emissiveIntensity={1.2} transparent opacity={0.85} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* 눈 */}
      <group ref={eyes} position={[0, 0.76, 0.245]}>
        {[-0.085, 0.085].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh scale={[1, 1.25, 0.5]}>
              <sphereGeometry args={[0.032, 16, 16]} />
              <meshStandardMaterial color="#1B1838" roughness={0.2} />
            </mesh>
            <mesh position={[0.01, 0.014, 0.014]}>
              <sphereGeometry args={[0.009, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
      </group>
      {/* 볼 */}
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.7, 0.21]} scale={[1, 0.6, 0.3]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#FF9FB2" roughness={0.6} />
        </mesh>
      ))}
      {/* 입 */}
      <mesh position={[0, 0.69, 0.255]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.03, 0.008, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#7A2E3B" />
      </mesh>
      {/* 새싹 */}
      <group ref={sprout} position={[0, 1.02, 0]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.11, 8]} />
          <meshStandardMaterial color="#3FBF7F" />
        </mesh>
        <mesh position={[-0.06, 0.11, 0]} rotation={[0, 0, 0.6]} scale={[1, 0.45, 0.6]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
        <mesh position={[0.06, 0.12, 0]} rotation={[0, 0, -0.6]} scale={[1, 0.45, 0.6]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={MINT} emissive={MINT} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
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

/** public/mascot.glb 가 있으면 그 모델, 없으면 갈림이 */
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
