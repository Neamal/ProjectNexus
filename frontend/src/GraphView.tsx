import { useCallback, useRef } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
} from "react-force-graph-2d";

interface GraphNode {
  id: string;
  name: string;
}

interface GraphLink {
  source: string;
  target: string;
  count?: number;
}

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNode: string | null;
  onNodeClick: (email: string) => void;
  width: number;
  height: number;
}

export default function GraphView({
  nodes,
  links,
  selectedNode,
  onNodeClick,
  width,
  height,
}: Props) {
  const fgRef = useRef<ForceGraphMethods<NodeObject>>(undefined);

  const handleClick = useCallback(
    (node: NodeObject) => {
      if (node.id) onNodeClick(node.id as string);
    },
    [onNodeClick]
  );

  const paintNode = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = (node as unknown as GraphNode).name ?? (node.id as string);
      const fontSize = 14 / globalScale;
      const isSelected = node.id === selectedNode;
      const radius = isSelected ? 8 : 5;

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#f97316" : "#6366f1";
      ctx.fill();

      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(label, node.x!, node.y! + radius + 2);
    },
    [selectedNode]
  );

  return (
    <ForceGraph2D
      ref={fgRef}
      width={width}
      height={height}
      graphData={{ nodes, links }}
      nodeId="id"
      nodeCanvasObject={paintNode}
      nodePointerAreaPaint={(node, color, ctx) => {
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, 8, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }}
      linkColor={() => "#475569"}
      linkWidth={1.5}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={1}
      onNodeClick={handleClick}
      backgroundColor="#0f172a"
    />
  );
}
