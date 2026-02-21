"""
Stub extraction module.

Replace this with an LLM call, NLP pipeline, or rule-based parser.
For now it returns hardcoded sample data so the rest of the system can
be developed and tested end-to-end.
"""


def extract_people_and_relationships(raw_text: str) -> dict:
    """
    Parse raw email text and return structured data.

    Returns:
        {
            "people": [{"name": str, "email": str}, ...],
            "relationships": [{"from": str, "to": str, "properties": dict}, ...]
        }

    TODO: Replace with real extraction logic (LLM, regex, spaCy, etc.)
    """
    return {
        "people": [
            {"name": "Alice Chen", "email": "alice@example.com"},
            {"name": "Bob Martinez", "email": "bob@example.com"},
            {"name": "Carol Wu", "email": "carol@example.com"},
            {"name": "Dave Johnson", "email": "dave@example.com"},
            {"name": "Eve Park", "email": "eve@example.com"},
        ],
        "relationships": [
            {"from": "alice@example.com", "to": "bob@example.com", "properties": {"count": 12}},
            {"from": "alice@example.com", "to": "carol@example.com", "properties": {"count": 5}},
            {"from": "bob@example.com", "to": "dave@example.com", "properties": {"count": 8}},
            {"from": "carol@example.com", "to": "eve@example.com", "properties": {"count": 3}},
            {"from": "dave@example.com", "to": "alice@example.com", "properties": {"count": 7}},
            {"from": "eve@example.com", "to": "bob@example.com", "properties": {"count": 2}},
        ],
    }
