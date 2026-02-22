# ProjectNexus

Transform raw email data into a Neo4j relationship graph, query it with RAG, and visualize it in an interactive React app.

## Architecture

```
AI Agent (write) ──▶ Neo4j ◀── FastAPI (read) ◀── React Frontend
                            │
                            └── Pinecone (RAG) + OpenRouter (LLM)
```

- **Agent** — Parses email chains (CSV or sample data), extracts people and relationships, inserts into Neo4j. Can generate edge summaries and index content for RAG.
- **Neo4j** — Graph store: `Person` nodes and `COMMUNICATES_WITH` edges (with optional summaries and comments).
- **Backend** — FastAPI: graph read API, subgraph by person, metadata, edge summarization, RAG query (Pinecone + OpenRouter), and graph insights (anomaly detection, bridges, centrality).
- **Frontend** — React + TypeScript + Vite, with force-directed graph (react-force-graph-2d), RAG Q&A, and insights panel.

## Quick Start

### 1. Start Neo4j

```bash
docker compose up -d
```

Neo4j Browser: http://localhost:7474 (default: `neo4j` / `nexus_pass`).

### 2. Environment

Create a `.env` in the project root (optional for graph-only use; required for RAG and LLM features):

```bash
# Neo4j (defaults shown)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=nexus_pass

# OpenRouter (for summaries and RAG/insights)
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=openai/gpt-4o

# Pinecone (for RAG)
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=projectnexus
RAG_NAMESPACES=epstein_emails
```

### 3. Run the Agent (seed or ingest data)

```bash
cd agent
pip install -r requirements.txt
# Seed with sample chain
python main.py ingest
# Or use fake chains
python main.py ingest-fake
# Or from CSV
python main.py ingest-csv [path/to/file.csv]
# Optional: generate edge summaries
python main.py summarize [--force] [--workers 8]
```

### 4. Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Set `VITE_API_URL` if the API is not at `http://localhost:8000`.

## Features

- **Graph** — Full graph and subgraph by person (depth 1–5); clustering and recluster via `?recluster=1`.
- **RAG** — POST `/query` with a question; backend embeds, searches Pinecone, and answers via OpenRouter.
- **Insights** — GET `/insights` for anomaly/bridge/centrality; POST `/insights` for LLM-generated graph insights.
- **Summaries** — On-demand or batch edge summaries from relationship comments (OpenRouter).

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/graph` | GET | Full graph (nodes + edges); optional `?recluster=1` |
| `/graph/{email}` | GET | Subgraph around person (`depth=1..5`) |
| `/meta` | GET | Node/edge counts and degree list |
| `/graph/summarize` | POST | Generate LLM summary for an edge |
| `/insights` | GET | Anomaly and graph-structure insights |
| `/query` | POST | RAG Q&A (question, optional model/namespaces) |
| `/insights` | POST | LLM-generated graph insights |

## Data preprocessing (`Notebook_Data/`)

Raw email data is prepared for the graph and RAG pipeline using Jupyter notebooks in `Notebook_Data/`.

### `chunk_data_and_epstein.ipynb`

- **Enron emails** — Reads a single large CSV (`backend/emails.csv` or similar) with columns `file` and `message` (multi-line email bodies). Uses a custom `iter_email_batches()` parser to handle multi-line CSV rows in chunks (e.g. 5k rows per batch), then writes the full DataFrame to **Parquet chunks** in `backend/email_chunks/` (e.g. `emails_part_1.parquet` … `emails_part_N.parquet`, 100k rows each). These chunks are used by the backend/agent for embedding and RAG indexing.
- **Epstein emails** — Reads pre-annotated email records from `Notebook_Data/epstein_emails_insights_all.txt` (or a copy in `backend/`). The file is a **JSON array** of objects with fields such as `source_file`, `subject`, `date`, `participants`, `people_mentioned`, `notable_figures`, `organizations`, `locations`, `summary`, `primary_topic`, `topics`, `tone`, and `email_text`. This structured data can be used for RAG (e.g. namespace `epstein_emails`) and for building or enriching the relationship graph.

### `enron-spam-email-detection.ipynb`

- **Spam detection** — Enron-style email classification (spam vs. ham). Useful for filtering or labeling emails before ingestion or for analysis; typically used with Enron/Kaggle-style datasets.

### Outputs and downstream use

| Output / file | Used by |
|---------------|--------|
| `backend/email_chunks/*.parquet` | Backend/agent for RAG indexing (Enron content) |
| `epstein_emails_insights_all.txt` | RAG namespace `epstein_emails`; optional graph enrichment |

Run the notebooks (e.g. in order: Enron chunking, then Epstein loading) before indexing to Pinecone or ingesting into Neo4j if you rely on these preprocessed assets.

## Requirements

- **Agent / Backend:** Python 3.x, see `agent/requirements.txt` and `backend/requirements.txt`.
- **Frontend:** Node 18+, see `frontend/package.json`.
- **Neo4j:** Docker (or local Neo4j 5). For RAG: Pinecone index (e.g. dimension 384, cosine), created via agent indexing or Pinecone console.
