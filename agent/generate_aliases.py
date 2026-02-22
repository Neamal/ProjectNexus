import pandas as pd
import re
import json
import os

def generate_aliases():
    print("Loading CSV...")
    df = pd.read_csv("raw_data/epstein_email.csv")
    sample_texts = df["email_text"].dropna().tolist()

    name_email_map = {}

    # Use regex that does not cross line boundaries
    # E.g. From: John Doe <john@example.com>
    pattern1 = r'(?i)^From:\s*([^<\n]+?)\s*(?:<|\[)([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)(?:>|\])'
    pattern2 = r'(?i)^To:\s*([^<\n]+?)\s*(?:<|\[)([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)(?:>|\])'
    pattern3 = r'(?i)^Cc:\s*([^<\n]+?)\s*(?:<|\[)([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)(?:>|\])'

    print("Extracting names...")
    for s in sample_texts:
        # Split into lines to ensure we only look at header lines
        lines = str(s).split('\n')
        for line in lines[:20]: # Headers are usually at the top
            for pattern in [pattern1, pattern2, pattern3]:
                for match in re.finditer(pattern, line):
                    name = match.group(1).strip().strip('"').strip("'")
                    email = match.group(2).lower()
                    
                    # Basic validation: name shouldn't be too long, shouldn't contain @, shouldn't be the email itself
                    if name and email and name.lower() not in email and len(name) > 2 and len(name) <= 40 and "@" not in name:
                        if email not in name_email_map:
                            name_email_map[email] = []
                        name_email_map[email].append(name)

    # Resolve to a single canonical name
    # We prefer the most frequent name observed
    import collections
    
    # Manual overrides for known aliases
    manual_overrides = {
        "jeffrey e.": "Jeffrey Epstein",
        "g maxwell": "Ghislaine Maxwell"
    }
    
    final_aliases = {}
    for email, names_list in name_email_map.items():
        # filter out names with excessive punct indicating multiple people
        valid = [n for n in names_list if not any(c in n for c in (';', ','))]
        if not valid:
            valid = names_list # fallback
        counter = collections.Counter(valid)
        canonical = counter.most_common(1)[0][0]
        
        # Apply manual override if it exists
        if canonical.lower() in manual_overrides:
            canonical = manual_overrides[canonical.lower()]
            
        final_aliases[email] = canonical
        
    output_path = "agent/aliases.json"
    with open(output_path, "w") as f:
        json.dump(final_aliases, f, indent=2)
        
    print(f"Extraction complete! Saved {len(final_aliases)} unique aliases to {output_path}")

if __name__ == "__main__":
    generate_aliases()
