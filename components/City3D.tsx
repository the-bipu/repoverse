"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { CityData, CityBuilding } from "@/lib/buildCity";

const GAP = 2.2;

function Building({ b, columns }: { b: CityBuilding; columns: number }) {
  const [hovered, setHovered] = useState(false);
  const x = (b.col - (columns - 1) / 2) * GAP;
  const z = b.row * GAP;
  const color = b.kind === "folder" ? "#5EEAD4" : "#FFB454";

  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, b.height / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.4, b.height, 1.4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.55 : 0.15}
          transparent
          opacity={b.kind === "folder" ? 1 : 0.85}
        />
      </mesh>
      {hovered && (
        <Html position={[0, b.height + 0.6, 0]} center distanceFactor={10}>
          <div
            style={{
              background: "#12161F",
              border: "1px solid #262D3D",
              color: "#E8ECF4",
              padding: "6px 10px",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 12,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 600 }}>{b.name}</div>
            <div style={{ color: "#8892A6" }}>
              {b.fileCount} file{b.fileCount === 1 ? "" : "s"}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export default function City3D({ data }: { data: CityData }) {
  const { buildings, columns } = data;

  const rows = useMemo(
    () => (buildings.length ? Math.max(...buildings.map((b) => b.row)) + 1 : 1),
    [buildings]
  );

  const groundWidth = columns * GAP + 6;
  const groundDepth = rows * GAP + 6;
  const centerZ = groundDepth / 2 - GAP / 2;

  return (
    <Canvas
      camera={{ position: [groundWidth * 0.55, groundWidth * 0.65, groundDepth * 0.95], fov: 45 }}
      style={{ background: "#0B0E14" }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 18, 6]} intensity={0.9} color="#FFB454" />
      <directionalLight position={[-10, 10, -6]} intensity={0.3} color="#5EEAD4" />
      <fog attach="fog" args={["#0B0E14", groundWidth * 0.7, groundWidth * 2.6]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, centerZ]}>
        <planeGeometry args={[groundWidth, groundDepth]} />
        <meshStandardMaterial color="#12161F" />
      </mesh>

      {buildings.map((b) => (
        <Building key={b.id} b={b} columns={columns} />
      ))}

      <OrbitControls
        enablePan
        minDistance={4}
        maxDistance={groundWidth * 3}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 2, centerZ]}
      />
    </Canvas>
  );
}
