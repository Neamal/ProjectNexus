"""Read-only Pinecone client for the backend query pipeline."""

from pinecone import Pinecone
from sentence_transformers import SentenceTransformer
from config import (
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    EMBEDDING_MODEL,
    RAG_TOP_K,
)

_index = None
_model = None


def get_index():
    global _index
    if _index is None:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        _index = pc.Index(PINECONE_INDEX_NAME)
    return _index


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def embed_query(text: str) -> list[float]:
    """Embed a single query string locally."""
    model = get_model()
    embedding = model.encode([text])[0]
    return embedding.tolist()


def search(
    query: str,
    namespaces: list[str] | None = None,
    top_k: int | None = None,
) -> list[dict]:
    """Search Pinecone across namespaces.

    Returns a list of metadata dicts with score, sorted by relevance.
    """
    top_k = top_k or RAG_TOP_K
    namespaces = namespaces or ["emails", "relationships", "email_chains", "epstein_emails", "enron_filtered"]
    vector = embed_query(query)
    index = get_index()

    results = []
    for ns in namespaces:
        response = index.query(
            vector=vector, top_k=top_k, namespace=ns, include_metadata=True
        )
        for match in response.matches:
            results.append(
                {"score": match.score, "namespace": ns, **match.metadata}
            )

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]
