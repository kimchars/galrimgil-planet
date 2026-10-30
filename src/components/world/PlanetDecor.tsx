// 행성 꾸미기: 대륙 색, 도시 불빛, 네온 숲, 구름, 대기 글로우, 고리, 달, 위성
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { R } from '../../lib/graph';

const UP = new THREE.Vector3(0, 1, 0);

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noise = (v: THREE.Vector3) =>
  Math.sin(v.x * 1.7 + 1.3) * Math.cos(v.y * 1.9 - 0.7) + Math.sin(v.z * 2.3 + v.x * 0.8) * 0.6 + Math.cos(v.y * 3.1 + v.z * 1.4) * 0.3;

function randomOnLand(r: () => number, minN: number) {
  for (let k = 0; k < 400; k++) {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    if (noise(v.clone().multiplyScalar(2)) > minN) return v;
  }
  return new THREE.Vector3(0, 1, 0);
}

/** 행성 본체 + 표면 장식 (행성과 같이 회전) */
export function PlanetBody() {
  const geom = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(R, 6);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const v = new THREE.Vector3();
    const deep = new THREE.Color('#101a4d');
    const shallow = new THREE.Color('#1c3d86');
    const coast = new THREE.Color('#2bb3a8');
    const land = new THREE.Color('#2a6f78');
    const high = new THREE.Color('#5b47b8');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = noise(v.clone().normalize().multiplyScalar(2));
      let c = deep;
      let lift = 0;
      if (n > -0.15) c = shallow;
      if (n > 0.18) { c = coast; lift = 0.01; }
      if (n > 0.26) { c = land; lift = 0.03; }
      if (n > 0.8) { c = high; lift = 0.07; }
      v.normalize().multiplyScalar(R + lift);
      pos.setXYZ(i, v.x, v.y, v.z);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const deco = useMemo(() => {
    const r = seeded(77);
    const trees: { p: THREE.Vector3; q: THREE.Quaternion; s: number; c: string }[] = [];
    for (let i = 0; i < 90; i++) {
      const v = randomOnLand(r, 0.3);
      trees.push({ p: v.clone().multiplyScalar(R + 0.03), q: new THREE.Quaternion().setFromUnitVectors(UP, v), s: 0.7 + r() * 0.7, c: r() < 0.6 ? '#3fe0a0' : '#9b87ff' });
    }
    const cities: { p: THREE.Vector3; q: THREE.Quaternion; bs: { x: number; z: number; h: number }[] }[] = [];
    for (let i = 0; i < 16; i++) {
      const v = randomOnLand(r, 0.35);
      const bs = Array.from({ length: 5 + Math.floor(r() * 6) }, () => ({ x: (r() - 0.5) * 0.28, z: (r() - 0.5) * 0.28, h: 0.05 + r() * 0.18 }));
      cities.push({ p: v.clone().multiplyScalar(R + 0.03), q: new THREE.Quaternion().setFromUnitVectors(UP, v), bs });
    }
    const clouds: { p: THREE.Vector3; q: THREE.Quaternion; s: number }[] = [];
    for (let i = 0; i < 18; i++) {
      const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
      clouds.push({ p: v.clone().multiplyScalar(R + 0.42 + r() * 0.15), q: new THREE.Quaternion().setFromUnitVectors(UP, v), s: 0.6 + r() * 0.8 });
    }
    const lights: number[] = [];
    for (let i = 0; i < 700; i++) {
      const v = randomOnLand(r, 0.26).multiplyScalar(R * 1.012);
      lights.push(v.x, v.y, v.z);
    }
    return { trees, cities, clouds, lights: new Float32Array(lights) };
  }, []);

  return (
    <group>
      <mesh geometry={geom}>
        <meshStandardMaterial vertexColors flatShading roughness={0.75} metalness={0.1} emissive="#0a0f33" emissiveIntensity={0.6} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[R * 1.004, 3]} />
        <meshBasicMaterial color="#4FF0FF" wireframe transparent opacity={0.05} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[deco.lights, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#FFD58A" size={0.03} sizeAttenuation transparent opacity={0.8} />
      </points>
      {deco.trees.map((t, i) => (
        <group key={`t${i}`} position={t.p} quaternion={t.q} scale={t.s}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.008, 0.012, 0.06, 5]} />
            <meshStandardMaterial color="#3b2f5c" />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <coneGeometry args={[0.045, 0.13, 6]} />
            <meshStandardMaterial color={t.c} emissive={t.c} emissiveIntensity={0.55} flatShading toneMapped={false} />
          </mesh>
        </group>
      ))}
      {deco.cities.map((c, i) => (
        <group key={`c${i}`} position={c.p} quaternion={c.q}>
          {c.bs.map((b, k) => (
            <mesh key={k} position={[b.x, b.h / 2, b.z]}>
              <boxGeometry args={[0.045, b.h, 0.045]} />
              <meshStandardMaterial color="#20285e" emissive={k % 3 === 0 ? '#FF5FA2' : '#FFD58A'} emissiveIntensity={0.9} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {deco.clouds.map((c, i) => (
        <group key={`cl${i}`} position={c.p} quaternion={c.q} scale={c.s}>
          {[
            [0, 0, 0, 0.09],
            [0.08, -0.01, 0.02, 0.07],
            [-0.08, -0.01, -0.01, 0.065],
          ].map(([x, y, z, rr], k) => (
            <mesh key={k} position={[x, y, z]}>
              <sphereGeometry args={[rr, 12, 12]} />
              <meshStandardMaterial color="#e6ecff" transparent opacity={0.55} roughness={1} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** 프레넬 대기 글로우 (행성 밖, 고정) */
export function Atmosphere() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { glow: { value: new THREE.Color('#6f9bff') }, rim: { value: new THREE.Color('#4FF0FF') } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 glow; uniform vec3 rim; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); vec3 c = mix(glow, rim, f); gl_FragColor = vec4(c, f*0.85); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh scale={1.16}>
      <sphereGeometry args={[R, 64, 64]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/** 고리 + 달 + 위성 (궤도를 천천히 돎) */
export function Orbiters() {
  const moon = useRef<THREE.Group>(null);
  const sat1 = useRef<THREE.Group>(null);
  const sat2 = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Points>(null);
  const ringPts = useMemo(() => {
    const r = seeded(9);
    const a: number[] = [];
    for (let i = 0; i < 900; i++) {
      const t = r() * Math.PI * 2;
      const rad = R * (1.55 + r() * 0.35);
      a.push(Math.cos(t) * rad, (r() - 0.5) * 0.05, Math.sin(t) * rad);
    }
    return new Float32Array(a);
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (moon.current) moon.current.position.set(Math.cos(t * 0.12) * R * 2.6, 1.6 + Math.sin(t * 0.12) * 0.8, Math.sin(t * 0.12) * R * 2.6 - 2);
    if (sat1.current) {
      sat1.current.position.set(Math.cos(t * 0.35) * R * 1.45, R * 0.5 + Math.sin(t * 0.35) * 0.6, Math.sin(t * 0.35) * R * 1.45);
      sat1.current.rotation.y = t * 0.8;
    }
    if (sat2.current) {
      sat2.current.position.set(Math.cos(-t * 0.25 + 2) * R * 1.6, -R * 0.2 + Math.cos(t * 0.25) * 0.8, Math.sin(-t * 0.25 + 2) * R * 1.6);
      sat2.current.rotation.y = -t * 0.6;
    }
    if (ring.current) ring.current.rotation.y = t * 0.02;
  });
  const Satellite = () => (
    <group scale={0.55}>
      <mesh>
        <boxGeometry args={[0.16, 0.16, 0.22]} />
        <meshStandardMaterial color="#d9defa" metalness={0.6} roughness={0.3} />
      </mesh>
      {[-0.26, 0.26].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.3, 0.01, 0.14]} />
          <meshStandardMaterial color="#3a5bff" emissive="#3a5bff" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#FF5FA2" emissive="#FF5FA2" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
  return (
    <group>
      <group rotation={[0.42, 0, 0.18]}>
        <points ref={ring}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[ringPts, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#B388FF" size={0.035} sizeAttenuation transparent opacity={0.55} />
        </points>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R * 1.75, 0.01, 6, 180]} />
          <meshBasicMaterial color="#B388FF" transparent opacity={0.35} />
        </mesh>
      </group>
      <group ref={moon}>
        <mesh>
          <icosahedronGeometry args={[0.42, 3]} />
          <meshStandardMaterial color="#c9c2ff" emissive="#5d4bd6" emissiveIntensity={0.35} flatShading roughness={0.9} />
        </mesh>
        <mesh scale={1.25}>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshBasicMaterial color="#8f7bff" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <group ref={sat1}>
        <Satellite />
      </group>
      <group ref={sat2}>
        <Satellite />
      </group>
    </group>
  );
}
