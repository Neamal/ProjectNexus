import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from "react-force-graph-2d";

interface GraphNode {
  id: string;
  name: string;
  cluster?: number;
  isClusterNode?: boolean;
  memberCount?: number;
}

interface GraphLink {
  source: string;
  target: string;
  count?: number;
  summary?: string;
}

const CLUSTER_COLORS = [
  "#6366f1", // indigo
  "#f97316", // orange
  "#22c55e", // green
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#a855f7", // purple
  "#ef4444", // red
  "#14b8a6", // teal
  "#f59e0b", // amber
];

// Softer pastel tints for sticky-note fills (graph tab)
const NOTE_FILLS = [
  "#c7d2fe", // indigo tint
  "#fed7aa", // orange tint
  "#bbf7d0", // green tint
  "#fbcfe8", // pink tint
  "#a5f3fc", // cyan tint
  "#fef08a", // yellow tint
  "#e9d5ff", // purple tint
  "#fecaca", // red tint
  "#99f6e4", // teal tint
  "#fde68a", // amber tint
];

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNodes: Set<string>;
  onNodeClick: (email: string, isShift: boolean) => void;
  onNodesSelect: (ids: string[]) => void;
  onLinkClick: (source: string, target: string) => void;
  onBackgroundClick: () => void;
  width: number;
  height: number;
  showClusters?: boolean;
  resetLayoutSignal?: number;
}

export default function GraphView({
  nodes,
  links,
  selectedNodes,
  onNodeClick,
  onNodesSelect,
  onLinkClick,
  onBackgroundClick,
  width,
  height,
  showClusters = false,
  resetLayoutSignal,
}: Props) {
  const fgRef = useRef<ForceGraphMethods<NodeObject>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const [isReady, setIsReady] = useState(false);

  const hasClusterNodes = nodes.some((n) => n.isClusterNode);

  const boardExtent = useMemo(() => {
    if (showClusters) return null;
    const n = nodes.length;
    const baseHalf = Math.max(200, 80 * Math.sqrt(n));
    return { half: baseHalf };
  }, [nodes.length, showClusters]);

  const settled = useRef(false);
  const userInteracted = useRef(false);
  const lastResetSignal = useRef<number | undefined>(resetLayoutSignal);

  useMemo(() => {
    const limit = (boardExtent && boardExtent.half) ? boardExtent.half : 400;
    const clusterMap = new Map<number, GraphNode[]>();
    nodes.forEach(n => {
      const c = n.cluster ?? 0;
      if (!clusterMap.has(c)) clusterMap.set(c, []);
      clusterMap.get(c)!.push(n);
    });

    const clusters = Array.from(clusterMap.keys());
    const clusterCount = clusters.length;

    for (const node of nodes as (GraphNode & { fx?: number; fy?: number; x?: number; y?: number })[]) {
      if (node.x == null || node.y == null) {
        const cIdx = clusters.indexOf(node.cluster ?? 0);
        const clusterAngle = (cIdx / Math.max(1, clusterCount)) * Math.PI * 2;
        const clusterRadius = limit * 0.4;
        const cx = Math.cos(clusterAngle) * clusterRadius;
        const cy = Math.sin(clusterAngle) * clusterRadius;

        node.x = cx + (Math.random() * 2 - 1) * 50;
        node.y = cy + (Math.random() * 2 - 1) * 50;
      }

      node.fx = undefined;
      node.fy = undefined;
      (node as any).__userPinned = false;
    }
    settled.current = false;
  }, [nodes, boardExtent]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    if (hasClusterNodes) {
      fg.d3Force("charge")?.strength(-300).distanceMax(550);
      fg.d3Force("link")?.distance(280).strength(0.5);
    } else {
      fg.d3Force("charge")?.strength(-650).distanceMax(700);
      fg.d3Force("link")?.distance(320).strength(0.3);

      fg.d3Force("center", () => {
        for (const node of nodes as (GraphNode & { x?: number; y?: number; vx?: number; vy?: number })[]) {
          if (node.x != null && node.y != null) {
            node.vx = (node.vx ?? 0) - node.x * 0.0035;
            node.vy = (node.vy ?? 0) - node.y * 0.0035;
          }
        }
      });

      if (boardExtent) {
        const bHalf = boardExtent.half;
        const pad = 60;
        const limit = bHalf - pad;
        fg.d3Force("bound", () => {
          for (const node of nodes as (GraphNode & { x?: number; y?: number; vx?: number; vy?: number })[]) {
            if (node.isClusterNode) continue;
            if (node.x != null && node.x > limit) { node.vx = (node.vx ?? 0) - 0.2; }
            if (node.x != null && node.x < -limit) { node.vx = (node.vx ?? 0) + 0.2; }
            if (node.y != null && node.y > limit) { node.vy = (node.vy ?? 0) - 0.2; }
            if (node.y != null && node.y < -limit) { node.vy = (node.vy ?? 0) + 0.2; }
          }
        });
      }
    }

    // Custom force to brutally enforce a completely static layout.
    // If settled.current is true, we overwrite velocity and clamp positions every tick.
    // This absolutely guarantees ZERO physics movements after the initial layout.
    fg.d3Force("pinClamp", () => {
      if (!settled.current) return;
      for (const node of nodes as (GraphNode & { _fx?: number; _fy?: number; fx?: number; fy?: number; x?: number; y?: number; vx?: number; vy?: number; __userPinned?: boolean })[]) {
        node.vx = 0;
        node.vy = 0;
        if (node.fx != null) node.x = node.fx;
        else if (node.x != null) {
          // Backup enforcement in case the library nulled fx (e.g., during click)
          node.fx = node.x;
        }
        if (node.fy != null) node.y = node.fy;
        else if (node.y != null) {
          node.fy = node.y;
        }
      }
    });


  }, [hasClusterNodes, boardExtent, nodes]);

  const handleEngineStop = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    for (const node of nodes as (GraphNode & { x?: number; y?: number; fx?: number; fy?: number })[]) {
      if (node.x != null) node.fx = node.x;
      if (node.y != null) node.fy = node.y;
      (node as any).__userPinned = true;
    }

    const fg = fgRef.current;
    if (fg && !userInteracted.current) {
      fg.zoomToFit(400, 150);
      // Wait a bit for the zoom to finish before showing
      setTimeout(() => setIsReady(true), 400);
    } else {
      setIsReady(true);
    }
  }, [nodes, boardExtent, width, height]);

  const graphData = useMemo(() => {
    return { nodes, links, _signal: resetLayoutSignal };
  }, [nodes, links, resetLayoutSignal]);

  useEffect(() => {
    if (resetLayoutSignal == null || resetLayoutSignal === lastResetSignal.current) {
      lastResetSignal.current = resetLayoutSignal;
      return;
    }
    lastResetSignal.current = resetLayoutSignal;
    userInteracted.current = false;
    settled.current = false;

    for (const node of nodes as (GraphNode & { fx?: number; fy?: number; x?: number; y?: number })[]) {
      node.fx = undefined;
      node.fy = undefined;
      (node as any).__userPinned = false;
      const kick = 10;
      node.x = (node.x ?? 0) + (Math.random() * 2 - 1) * kick;
      node.y = (node.y ?? 0) + (Math.random() * 2 - 1) * kick;
    }
  }, [resetLayoutSignal, nodes]);

  useEffect(() => {
    const fg = fgRef.current;
    if (fg && !userInteracted.current) {
      fg.zoomToFit(400, 150);
    }
  }, [boardExtent, width, height]);

  const handleClick = useCallback(
    (node: NodeObject, event: any) => {
      // Pass event.shiftKey if available
      if (node.id) onNodeClick(node.id as string, event.shiftKey);
    },
    [onNodeClick]
  );

  const handleLinkClick = useCallback(
    (link: LinkObject) => {
      const sourceId = typeof link.source === "object" ? (link.source as NodeObject).id as string : link.source as string;
      const targetId = typeof link.target === "object" ? (link.target as NodeObject).id as string : link.target as string;
      onLinkClick(sourceId, targetId);
    },
    [onLinkClick]
  );

  const handleNodeDrag = useCallback((node: NodeObject, translate: { x: number; y: number }) => {
    userInteracted.current = true;
    if (!settled.current) handleEngineStop();

    if (!selectedNodes.has(node.id as string)) {
      if (selectedNodes.size > 0) {
        onNodesSelect([node.id as string]);
      }
      return;
    }

    selectedNodes.forEach(id => {
      if (id === node.id) return; // Library already translated the dragged node natively
      const n = (nodes as any).find((gn: any) => gn.id === id);
      if (n) {
        n.x = (n.x || 0) + translate.x;
        n.y = (n.y || 0) + translate.y;
        n.fx = n.x;
        n.fy = n.y;
        n.vx = 0;
        n.vy = 0;
        (n as any).__userPinned = true;
      }
    });
  }, [nodes, selectedNodes, handleEngineStop, onNodesSelect]);

  const handleNodeDragEnd = useCallback((node: NodeObject) => {
    const targets = selectedNodes.has(node.id as string) ? Array.from(selectedNodes) : [node.id as string];
    // setTimeout ensures we re-pin the node AFTER react-force-graph-2d sets node.fx = null internally
    setTimeout(() => {
      targets.forEach(id => {
        const n = (nodes as any).find((gn: any) => gn.id === id);
        if (n) {
          n.vx = 0; n.vy = 0;
          n.fx = n.x; n.fy = n.y;
          (n as any).__userPinned = true;
        }
      });
    }, 0);
  }, [nodes, selectedNodes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionBox({ x1: x, y1: y, x2: x, y2: y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (selectionBox && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setSelectionBox(prev => prev ? { ...prev, x2: x, y2: y } : null);
    }
  };

  const handleMouseUp = () => {
    if (selectionBox) {
      const { x1, y1, x2, y2 } = selectionBox;
      // Only trigger selection if the box has some size (prevent mis-clicks)
      const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      if (dist > 5) {
        const fg = fgRef.current;
        if (fg) {
          const selectedIds: string[] = [];
          nodes.forEach((node: any) => {
            const { x, y } = fg.graph2ScreenCoords(node.x, node.y);
            if (x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) {
              selectedIds.push(node.id);
            }
          });
          onNodesSelect(selectedIds);
        }
      }
      setSelectionBox(null);
    }
  };

  const paintNode = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const gNode = node as unknown as GraphNode;
      const label = gNode.name ?? (node.id as string);
      const isSelected = selectedNodes.has(node.id as string);
      const ci = (gNode.cluster ?? 0) % CLUSTER_COLORS.length;
      const clusterColor = CLUSTER_COLORS[ci];

      if (gNode.isClusterNode) {
        const size = 14 + (gNode.memberCount ?? 3) * 1.5;
        const sides = 6;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = node.x! + size * Math.cos(angle);
          const py = node.y! + size * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = clusterColor + "33";
        ctx.fill();
        ctx.strokeStyle = clusterColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        const fontSize = Math.max(12, 16) / globalScale;
        ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = clusterColor;
        ctx.fillText(label, node.x!, node.y!);
      } else if (!showClusters) {
        const noteW = 64 / globalScale;
        const noteH = 52 / globalScale;
        const x = node.x! - noteW / 2;
        const y = node.y! - noteH / 2;
        const noteFill = NOTE_FILLS[ci];
        const cornerFold = 8 / globalScale;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 6 / globalScale;
        ctx.shadowOffsetX = 2 / globalScale;
        ctx.shadowOffsetY = 3 / globalScale;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + noteW - cornerFold, y);
        ctx.lineTo(x + noteW, y + cornerFold);
        ctx.lineTo(x + noteW, y + noteH);
        ctx.lineTo(x, y + noteH);
        ctx.closePath();
        ctx.fillStyle = noteFill;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(x + noteW - cornerFold, y);
        ctx.lineTo(x + noteW - cornerFold, y + cornerFold);
        ctx.lineTo(x + noteW, y + cornerFold);
        ctx.closePath();
        ctx.fillStyle = clusterColor + "44";
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + noteW - cornerFold, y);
        ctx.lineTo(x + noteW, y + cornerFold);
        ctx.lineTo(x + noteW, y + noteH);
        ctx.lineTo(x, y + noteH);
        ctx.closePath();
        ctx.strokeStyle = isSelected ? clusterColor : "rgba(0,0,0,0.15)";
        ctx.lineWidth = isSelected ? 2.5 / globalScale : 1 / globalScale;
        ctx.stroke();

        if (isSelected) {
          ctx.save();
          ctx.shadowColor = clusterColor;
          ctx.shadowBlur = 10 / globalScale;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + noteW - cornerFold, y);
          ctx.lineTo(x + noteW, y + cornerFold);
          ctx.lineTo(x + noteW, y + noteH);
          ctx.lineTo(x, y + noteH);
          ctx.closePath();
          ctx.strokeStyle = clusterColor;
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
          ctx.restore();
        }

        const pinX = node.x!;
        const pinY = y + 1 / globalScale;
        const pinR = 3.5 / globalScale;
        ctx.beginPath();
        ctx.arc(pinX, pinY, pinR, 0, 2 * Math.PI);
        ctx.fillStyle = "#b45309";
        ctx.fill();
        ctx.strokeStyle = "#92400e";
        ctx.lineWidth = 0.8 / globalScale;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pinX - 1 / globalScale, pinY - 1 / globalScale, 1.2 / globalScale, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();

        const silColor = clusterColor + "88";
        const cx = node.x!;
        const cy = node.y!;
        const s = 1 / globalScale;

        const headR = 6.5 * s;
        const headY = cy - 8 * s;
        ctx.beginPath();
        ctx.arc(cx, headY, headR, 0, Math.PI * 2);
        ctx.fillStyle = silColor;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, noteW, noteH);
        ctx.clip();
        const shoulderW = 14 * s;
        const shoulderH = 10 * s;
        const shoulderY = cy + 4 * s;
        ctx.beginPath();
        ctx.ellipse(cx, shoulderY, shoulderW, shoulderH, 0, Math.PI, 0, true);
        ctx.fillStyle = silColor;
        ctx.fill();
        ctx.restore();

        const fontSize = 10 / globalScale;
        ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1e293b";

        const words = label.split(" ");
        if (words.length > 1) {
          const lineH = fontSize * 1.3;
          ctx.fillText(words[0], cx, cy - lineH / 2);
          ctx.fillText(words.slice(1).join(" "), cx, cy + lineH / 2);
        } else {
          ctx.fillText(label, cx, cy);
        }
      } else {
        const radius = isSelected ? 8 : 5;
        const fontSize = 14 / globalScale;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isSelected ? "#ffffff" : clusterColor;
        ctx.fill();
        if (isSelected) {
          ctx.strokeStyle = clusterColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(label, node.x!, node.y! + radius + 2);
      }
    },
    [selectedNodes, showClusters]
  );

  const paintLinkLabel = useCallback(
    (link: LinkObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const src = link.source as NodeObject;
      const tgt = link.target as NodeObject;
      if (!src.x || !src.y || !tgt.x || !tgt.y) return;
      const emailCount = (link as any).count ?? 1;
      const midX = (src.x + tgt.x) / 2;
      const midY = (src.y + tgt.y) / 2;
      const fontSize = 10 / globalScale;
      const text = `${emailCount}`;
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(text).width;
      const pad = 3 / globalScale;
      ctx.fillStyle = showClusters ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.roundRect(midX - tw / 2 - pad, midY - fontSize / 2 - pad, tw + pad * 2, fontSize + pad * 2, 3 / globalScale);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = showClusters ? "#94a3b8" : "#5c3a1e";
      ctx.fillText(text, midX, midY);
    },
    [showClusters]
  );

  const corkPattern = useMemo(() => {
    if (showClusters) return null;
    const size = 512;
    const off = document.createElement("canvas");
    off.width = size; off.height = size;
    const c = off.getContext("2d")!;
    c.fillStyle = "#b5835a";
    c.fillRect(0, 0, size, size);
    const rand = (seed: number) => {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 18000; i++) {
      const x = rand(i * 1.1) * size;
      const y = rand(i * 2.3 + 7) * size;
      const r = rand(i * 3.7 + 13) * 1.8 + 0.3;
      const b = rand(i * 5.1 + 19);
      c.fillStyle = b < 0.5 ? `rgba(80, 50, 20, ${0.06 + b * 0.08})` : `rgba(210, 170, 120, ${0.04 + (b - 0.5) * 0.06})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    return off;
  }, [showClusters]);

  const woodPattern = useMemo(() => {
    if (showClusters) return null;
    const size = 256;
    const off = document.createElement("canvas");
    off.width = size; off.height = size;
    const c = off.getContext("2d")!;
    c.fillStyle = "#3e2216";
    c.fillRect(0, 0, size, size);
    return off;
  }, [showClusters]);

  const onRenderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (showClusters || !corkPattern) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const ft = 28;
      if (woodPattern) {
        const wp = ctx.createPattern(woodPattern, "repeat");
        if (wp) { ctx.fillStyle = wp; ctx.fillRect(0, 0, w, h); }
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(ft, ft, w - ft * 2, h - ft * 2); ctx.clip();
      const pat = ctx.createPattern(corkPattern, "repeat");
      if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); }
      ctx.restore();
      ctx.restore();
    },
    [showClusters, corkPattern, woodPattern]
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        cursor: "default",
        opacity: isReady ? 1 : 0,
        transition: "opacity 0.6s ease-in-out"
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        warmupTicks={200}
        cooldownTicks={0}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={paintNode}
        onRenderFramePre={showClusters ? undefined : (onRenderFramePre as any)}
        onEngineStop={handleEngineStop}
        onNodeClick={handleClick as any}
        onLinkClick={handleLinkClick}
        onBackgroundClick={onBackgroundClick}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        linkCanvasObject={paintLinkLabel}
        linkCanvasObjectMode={() => "after"}
        enablePointerInteraction={true}
        enablePanInteraction={false}
        nodePointerAreaPaint={(node, color, ctx) => {
          const gNode = node as unknown as GraphNode;
          if (gNode.isClusterNode) {
            const hitRadius = 14 + (gNode.memberCount ?? 3) * 1.5;
            ctx.beginPath(); ctx.arc(node.x!, node.y!, hitRadius, 0, 2 * Math.PI);
            ctx.fillStyle = color; ctx.fill();
          } else if (!showClusters) {
            const s = 35; ctx.fillStyle = color; ctx.fillRect(node.x! - s, node.y! - s, s * 2, s * 2);
          } else {
            ctx.beginPath(); ctx.arc(node.x!, node.y!, 8, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.stroke();
          }
        }}
        linkColor={() => (showClusters ? "#475569" : "#8B4513")}
        linkPointerAreaPaint={(link, color, ctx, globalScale) => {
          const src = link.source as NodeObject;
          const tgt = link.target as NodeObject;
          if (!src.x || !src.y || !tgt.x || !tgt.y) return;

          // Draw a thick line for the connection to make it easier to click
          ctx.strokeStyle = color;
          ctx.lineWidth = 14 / globalScale; // Thicker hit area, scaled so it stays useful
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.stroke();

          // Draw a blob in the middle to cover the exact label area
          const midX = (src.x + tgt.x) / 2;
          const midY = (src.y + tgt.y) / 2;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(midX, midY, 16 / globalScale, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkWidth={(link) => {
          const count = (link as unknown as GraphLink).count ?? 1;
          return Math.sqrt(count) * (showClusters ? 1.5 : 0.8);
        }}
        linkCurvature={0.03}
      />
      {selectionBox && (
        <div style={{
          position: "absolute", zIndex: 100, border: "2px solid #6366f1", backgroundColor: "rgba(99, 102, 241, 0.2)",
          left: Math.min(selectionBox.x1, selectionBox.x2), top: Math.min(selectionBox.y1, selectionBox.y2),
          width: Math.abs(selectionBox.x2 - selectionBox.x1), height: Math.abs(selectionBox.y2 - selectionBox.y1),
          pointerEvents: "none"
        }} />
      )}
    </div>
  );
}
