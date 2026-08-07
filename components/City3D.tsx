"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import type { CityData, CityBuilding, BuildingActivity, BuildingDiff } from "@/lib/buildCity";
import { ACTIVITY_COLORS, ACTIVITY_LABELS, DIFF_COLORS, getBuildingPosition, CITY_GAP } from "@/lib/buildCity";
import type { DependencyEdge } from "@/lib/dependencies";

export type CityMode = "structure" | "heatmap" | "compare" | "pr";

interface BuildingProps {
  b: CityBuilding;
  columns: number;
  mode: CityMode;
  activity?: BuildingActivity;
  diff?: BuildingDiff;
}

function buildingColor(b: CityBuilding, mode: CityMode, activity?: BuildingActivity, diff?: BuildingDiff) {
  if (mode === "heatmap") return activity ? ACTIVITY_COLORS[activity.level] : ACTIVITY_COLORS.unknown;
  if (mode === "compare" || mode === "pr") return diff ? DIFF_COLORS[diff.status] : DIFF_COLORS.unchanged;
  return b.kind === "folder" ? "#5EEAD4" : "#FFB454";
}

function Building({ b, columns, mode, activity, diff }: BuildingProps) {
  const [hovered, setHovered] = useState(false);
  const [x, z] = getBuildingPosition(b, columns);
  const color = buildingColor(b, mode, activity, diff);
  const dimmed = (mode === "compare" || mode === "pr") && (!diff || diff.status === "unchanged");

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
          emissiveIntensity={hovered ? 0.55 : dimmed ? 0.05 : mode === "structure" ? 0.15 : 0.3}
          transparent
          opacity={dimmed ? 0.35 : b.kind === "folder" || mode !== "structure" ? 1 : 0.85}
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
            {mode === "heatmap" && activity && (
              <div style={{ color, marginTop: 2 }}>
                {ACTIVITY_LABELS[activity.level]}
                {activity.lastCommitDate && ` · ${new Date(activity.lastCommitDate).toLocaleDateString()}`}
                {activity.author && ` · ${activity.author}`}
              </div>
            )}
            {(mode === "compare" || mode === "pr") && diff && diff.status !== "unchanged" && (
              <div style={{ color, marginTop: 2, textTransform: "capitalize" }}>
                {diff.status}
                {diff.added > 0 && ` · +${diff.added}`}
                {diff.removed > 0 && ` · -${diff.removed}`}
                {diff.modified > 0 && ` · ~${diff.modified}`}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function Roads({ edges, buildingsById, columns }: { edges: DependencyEdge[]; buildingsById: Map<string, CityBuilding>; columns: number }) {
  const maxWeight = Math.max(1, ...edges.map((e) => e.weight));
  return (
    <>
      {edges.map((e, i) => {
        const from = buildingsById.get(`folder-${e.from}`);
        const to = buildingsById.get(`folder-${e.to}`);
        if (!from || !to) return null;
        const [x1, z1] = getBuildingPosition(from, columns);
        const [x2, z2] = getBuildingPosition(to, columns);
        const midY = 0.08 + (e.weight / maxWeight) * 0.4;
        const points: [number, number, number][] = [
          [x1, 0.05, z1],
          [(x1 + x2) / 2, midY, (z1 + z2) / 2],
          [x2, 0.05, z2],
        ];
        return (
          <Line
            key={`${e.from}-${e.to}-${i}`}
            points={points}
            color="#5EEAD4"
            lineWidth={Math.max(1, Math.min(4, e.weight))}
            transparent
            opacity={0.5}
          />
        );
      })}
    </>
  );
}

export default function City3D({
  data,
  mode = "structure",
  activity = {},
  diff = {},
  edges = [],
  showRoads = false,
}: {
  data: CityData;
  mode?: CityMode;
  activity?: Record<string, BuildingActivity>;
  diff?: Record<string, BuildingDiff>;
  edges?: DependencyEdge[];
  showRoads?: boolean;
}) {
  const { buildings, columns } = data;

  const buildingsById = useMemo(() => {
    const map = new Map<string, CityBuilding>();
    for (const b of buildings) map.set(b.id, b);
    return map;
  }, [buildings]);

  const rows = useMemo(
    () => (buildings.length ? Math.max(...buildings.map((b) => b.row)) + 1 : 1),
    [buildings]
  );

  const groundWidth = columns * CITY_GAP + 6;
  const groundDepth = rows * CITY_GAP + 6;
  const centerZ = groundDepth / 2 - CITY_GAP / 2;

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
        <Building key={b.id} b={b} columns={columns} mode={mode} activity={activity[b.id]} diff={diff[b.name]} />
      ))}

      {showRoads && <Roads edges={edges} buildingsById={buildingsById} columns={columns} />}

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
