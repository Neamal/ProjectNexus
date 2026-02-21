from neo4j import GraphDatabase
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD


def get_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def ensure_constraints(driver):
    """Create uniqueness constraint on Person.email so merges are idempotent."""
    with driver.session() as session:
        session.run(
            "CREATE CONSTRAINT IF NOT EXISTS "
            "FOR (p:Person) REQUIRE p.email IS UNIQUE"
        )


def upsert_person(tx, name: str, email: str):
    tx.run(
        "MERGE (p:Person {email: $email}) "
        "SET p.name = $name",
        email=email,
        name=name,
    )


def upsert_relationship(tx, from_email: str, to_email: str, properties: dict | None = None):
    props = properties or {}
    tx.run(
        "MATCH (a:Person {email: $from_email}) "
        "MATCH (b:Person {email: $to_email}) "
        "MERGE (a)-[r:COMMUNICATES_WITH]->(b) "
        "SET r += $props",
        from_email=from_email,
        to_email=to_email,
        props=props,
    )
