# ProjectNexus

Transform raw email data into a Neo4j relationship graph and visualize it.

## Architecture

```
AI Agent (write) ──▶ Neo4j ◀── FastAPI (read-only) ◀── React Frontend
```

- **Agent** — Parses emails, extracts people + relationships, inserts into Neo4j
- **Neo4j** — Single source of truth (Person nodes, COMMUNICATES_WITH edges)
- **Backend** — Read-only FastAPI server that queries the graph
- **Frontend** — React + TypeScript app with interactive graph visualization

## Quick Start

### 1. Start Neo4j

```bash
docker compose up -d
```

Neo4j browser: http://localhost:7474 (credentials: `neo4j` / `nexus_pass`)

### 2. Run the AI Agent (seed data)

```bash
cd agent
pip install -r requirements.txt
python main.py
```

### 3. Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173
