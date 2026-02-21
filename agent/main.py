"""
AI Agent entry point.

Reads raw email data, extracts people and relationships,
and writes them into Neo4j.
"""

from graph import get_driver, ensure_constraints, upsert_person, upsert_relationship
from extract import extract_people_and_relationships

SAMPLE_EMAIL = """
From: alice@example.com
To: bob@example.com, carol@example.com
Subject: Project kickoff

Hi team, let's get started on the project.
"""


def ingest(raw_text: str):
    driver = get_driver()
    ensure_constraints(driver)

    data = extract_people_and_relationships(raw_text)

    with driver.session() as session:
        for person in data["people"]:
            session.execute_write(upsert_person, person["name"], person["email"])

        for rel in data["relationships"]:
            session.execute_write(
                upsert_relationship,
                rel["from"],
                rel["to"],
                rel.get("properties"),
            )

    driver.close()
    print(f"Ingested {len(data['people'])} people and {len(data['relationships'])} relationships.")


if __name__ == "__main__":
    ingest(SAMPLE_EMAIL)
