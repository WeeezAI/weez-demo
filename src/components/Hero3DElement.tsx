import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FloatingShapes = () => {
  const sphereRef = useRef<THREE.Mesh>(null);
  const torusRef = useRef<THREE.Mesh>(null);
  const icoRef = useRef<THREE.Mesh>(null);
  const smallRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (sphereRef.current) {
      sphereRef.current.rotation.y += 0.006;
      sphereRef.current.rotation.x = Math.sin(t * 0.4) * 0.15;
      const s = 1 + Math.sin(t * 1.2) * 0.03;
      sphereRef.current.scale.setScalar(s);
    }

    if (torusRef.current) {
      torusRef.current.rotation.x += 0.008;
      torusRef.current.rotation.z = Math.sin(t * 0.6) * 0.25;
    }

    if (icoRef.current) {
      icoRef.current.rotation.y += 0.012;
      icoRef.current.rotation.z = Math.cos(t * 0.5) * 0.2;
      icoRef.current.position.x = 2 + Math.sin(t * 0.8) * 0.15;
      icoRef.current.position.y = 0.5 + Math.cos(t * 0.9) * 0.15;
    }

    if (smallRef.current) {
      smallRef.current.rotation.y -= 0.01;
      smallRef.current.position.x = -1.8 + Math.cos(t * 0.9) * 0.12;
      smallRef.current.position.y = -0.8 + Math.sin(t * 1.1) * 0.12;
    }
  });

  return (
    <group>
      {/* Main sphere */}
      <mesh ref={sphereRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1.2, 64, 64]} />
        <meshPhysicalMaterial
          color="#8B5CF6"
          metalness={0.85}
          roughness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Torus ring */}
      <mesh ref={torusRef} position={[0, 0, 0]}>
        <torusGeometry args={[2, 0.08, 16, 120]} />
        <meshStandardMaterial color="#14131a" metalness={0.95} roughness={0.12} />
      </mesh>

      {/* Orbiting icosahedron */}
      <mesh ref={icoRef} position={[2, 0.5, 0]}>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial
          color="#A855F7"
          metalness={0.8}
          roughness={0.2}
          emissive="#7C3AED"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Secondary small sphere */}
      <mesh ref={smallRef} position={[-1.8, -0.8, 0.5]}>
        <sphereGeometry args={[0.22, 48, 48]} />
        <meshStandardMaterial
          color="#C084FC"
          metalness={0.7}
          roughness={0.25}
          emissive="#9333EA"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Tiny accents */}
      <mesh position={[1.5, -1, -0.5]}>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshStandardMaterial color="#0b0b0f" metalness={0.95} roughness={0.15} />
      </mesh>

      <mesh position={[-1.2, 1.2, 0.3]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshStandardMaterial
          color="#7C3AED"
          metalness={0.85}
          roughness={0.2}
          emissive="#6D28D9"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
};

const Hero3DElement = () => {
  return (
    <div className="w-full h-full min-h-[400px] md:min-h-[500px]">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
        <directionalLight position={[-5, -5, -5]} intensity={0.55} color="#8B5CF6" />
        <pointLight position={[0, 2, 3]} intensity={0.85} color="#A855F7" />
        <pointLight position={[-2, -2, 2]} intensity={0.45} color="#C084FC" />

        <FloatingShapes />
      </Canvas>
    </div>
  );
};

export default Hero3DElement;

