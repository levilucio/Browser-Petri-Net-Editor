"""
Test script for the PNML parser
"""
from petri_net_xml import pnml_to_json
import json

# Read the test PNML file
with open('test_pnml.xml', 'r') as f:
    pnml_string = f.read()

# Run the parser
result = pnml_to_json(pnml_string)

# Print the result
print("==================== PARSER RESULT ====================")
print(json.dumps(result, indent=2))
print("======================================================")
print(f"Places: {len(result['places'])}")
print(f"Transitions: {len(result['transitions'])}")
print(f"Arcs: {len(result['arcs'])}")
