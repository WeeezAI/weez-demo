import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Torus, Icosahedron } from '@react-three/drei';
import * as THREE from 'three';

const FloatingShape = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const torusRef = useRef<THREE.Mesh>(null);
  const icosaRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
      meshRef.current.rotation.y += 0.005;
    }
    
    if (torusRef.current) {
      torusRef.current.rotation.x += 0.008;
      torusRef.current.rotation.z = Math.sin(time * 0.5) * 0.3;
    }

    if (icosaRef.current) {
      icosaRef.current.rotation.y += 0.01;
      icosaRef.current.rotation.z = Math.cos(time * 0.4) * 0.2;
    }
  });

  return (
    <group>
      {/* Main distorted sphere - Purple */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <Sphere ref={meshRef} args={[1.2, 64, 64]} position={[0, 0, 0]}>
          <MeshDistortMaterial
            color="#8B5CF6"
            attach="material"
            distort={0.4}
            speed={2}
            roughness={0.2}
            metalness={0.8}
          />
        </Sphere>
      </Float>

      {/* Orbiting torus - Dark purple/black */}
      <Float speed={3} rotationIntensity={1} floatIntensity={0.5}>
        <Torus ref={torusRef} args={[2, 0.08, 16, 100]} position={[0, 0, 0]}>
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.9}
            roughness={0.1}
          />
        </Torus>
      </Float>

      {/* Small orbiting icosahedron */}
      <Float speed={4} rotationIntensity={2} floatIntensity={1.5}>
        <Icosahedron ref={icosaRef} args={[0.3]} position={[2, 0.5, 0]}>
          <meshStandardMaterial
            color="#A855F7"
            metalness={0.7}
            roughness={0.2}
            emissive="#7C3AED"
            emissiveIntensity={0.3}
          />
        </Icosahedron>
      </Float>

      {/* Secondary small sphere */}
      <Float speed={2.5} rotationIntensity={0.8} floatIntensity={2}>
        <Sphere args={[0.2]} position={[-1.8, -0.8, 0.5]}>
          <meshStandardMaterial
            color="#C084FC"
            metalness={0.6}
            roughness={0.3}
            emissive="#9333EA"
            emissiveIntensity={0.2}
          />
        </Sphere>
      </Float>

      {/* Tiny accent spheres */}
      <Float speed={5} rotationIntensity={0.3} floatIntensity={2.5}>
        <Sphere args={[0.1]} position={[1.5, -1, -0.5]}>
          <meshStandardMaterial color="#1f1f1f" metalness={0.9} roughness={0.1} />
        </Sphere>
      </Float>

      <Float speed={4.5} rotationIntensity={0.5} floatIntensity={2}>
        <Sphere args={[0.15]} position={[-1.2, 1.2, 0.3]}>
          <meshStandardMaterial
            color="#7C3AED"
            metalness={0.8}
            roughness={0.2}
            emissive="#6D28D9"
            emissiveIntensity={0.4}
          />
        </Sphere>
      </Float>
    </group>
  );
};

const Hero3DElement = () => {
  return (
    <div className="w-full h-full min-h-[400px] md:min-h-[500px]">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} color="#8B5CF6" />
        <pointLight position={[0, 2, 3]} intensity={0.8} color="#A855F7" />
        <pointLight position={[-2, -2, 2]} intensity={0.4} color="#C084FC" />
        
        {/* 3D Elements */}
        <FloatingShape />
      </Canvas>
    </div>
  );
};

export default Hero3DElement;
