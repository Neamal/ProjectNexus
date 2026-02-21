import { useEffect, useState } from "react";
import GraphView from "./GraphView";
import { fetchGraph, fetchSubgraph, fetchMeta, type GraphData, type MetaData } from "./api";

function toGraphNodes(data: GraphData) {
  return data.nodes.map((n) => ({ id: n.email, name: n.name }));
}

function toGraphLinks(data: GraphData) {
  return data.edges.map((e) => ({
    source: e.source,
    target: e.target,
    count: (e.properties?.count as number) ?? 1,
  }));
}

export default function App() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGraph().then(setGraphData).catch(() => setError("Could not connect to API. Is the backend running?"));
    fetchMeta().then(setMeta).catch(() => {});
  }, []);

  const handleNodeClick = async (email: string) => {
    setSelected(email);
    try {
      const sub = await fetchSubgraph(email, 2);
      setGraphData(sub);
    } catch {
      setError("Failed to load subgraph");
    }
  };

  const handleReset = async () => {
    setSelected(null);
    try {
      const full = await fetchGraph();
      setGraphData(full);
    } catch {
      setError("Failed to reload graph");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 280, padding: 20, borderRight: "1px solid #1e293b", overflowY: "auto", flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>ProjectNexus</h1>

        {meta && (
          <div style={{ marginBottom: 20, fontSize: 13, color: "#94a3b8" }}>
            <p>{meta.counts.node_count} people &middot; {meta.counts.edge_count} connections</p>
          </div>
        )}

        {selected && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>Focused on:</p>
            <p style={{ fontWeight: 600, color: "#f97316" }}>{selected}</p>
            <button
              onClick={handleReset}
              style={{ marginTop: 8, padding: "6px 12px", fontSize: 13, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}
            >
              Show full graph
            </button>
          </div>
        )}

        {meta && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#94a3b8" }}>By degree</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
              {meta.degrees.map((d) => (
                <li
                  key={d.email}
                  onClick={() => handleNodeClick(d.email)}
                  style={{ padding: "4px 0", cursor: "pointer", color: d.email === selected ? "#f97316" : "#cbd5e1" }}
                >
                  {d.name} <span style={{ color: "#64748b" }}>({d.degree})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Graph */}
      <main style={{ flex: 1, position: "relative" }}>
        {error && (
          <div style={{ position: "absolute", top: 20, left: 20, padding: "10px 16px", background: "#7f1d1d", borderRadius: 8, fontSize: 14, zIndex: 10 }}>
            {error}
          </div>
        )}
        {graphData ? (
          <GraphView
            nodes={toGraphNodes(graphData)}
            links={toGraphLinks(graphData)}
            selectedNode={selected}
            onNodeClick={handleNodeClick}
            width={window.innerWidth - 280}
            height={window.innerHeight}
          />
        ) : (
          !error && <p style={{ padding: 40 }}>Loading graph...</p>
        )}
      </main>
    </div>
  );
}
