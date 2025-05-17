"""
Debug script for the PNML parser - this directly tests the exact PNML format provided by the user
"""
from lxml import etree
import json
import traceback

# The exact PNML string provided by the user
pnml_string = """<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <name>
      <text>Petri Net</text>
    </name>
    <page id="page1">
      <place id="place-1747503889991">
        <name>
          <text>P1</text>
        </name>
        <graphics>
          <position x="360" y="80"/>
        </graphics>
      </place>
      <transition id="transition-1747503891563">
        <name>
          <text>T1</text>
        </name>
        <graphics>
          <position x="520" y="320"/>
        </graphics>
      </transition>
      <arc id="arc-1747503895775" source="place-1747503889991" target="transition-1747503891563">
        <graphics>
          <metadata>
            <sourceDirection>south</sourceDirection>
            <targetDirection>north</targetDirection>
          </metadata>
        </graphics>
      </arc>
    </page>
  </net>
</pnml>"""

def debug_pnml_parsing():
    """Direct debugging of PNML parsing"""
    try:
        # Initialize result structure
        result = {
            'places': [],
            'transitions': [],
            'arcs': []
        }
        
        # Parse the XML string directly
        print("Parsing XML string...")
        parser = etree.XMLParser(remove_blank_text=True)
        root = etree.fromstring(pnml_string.encode('utf-8'), parser)
        
        print(f"Root tag: {root.tag}")
        print(f"Root nsmap: {root.nsmap}")
        
        # Get namespace with proper handling of default namespace
        nsmap = {}
        if None in root.nsmap:
            nsmap['pnml'] = root.nsmap[None]
        else:
            nsmap['pnml'] = "http://www.pnml.org/version-2009/grammar/pnml"
        
        print(f"Using namespace map: {nsmap}")
        
        # Direct approach to get page element
        net = root.find(".//{%s}net" % nsmap['pnml'])
        if net is None:
            net = root.find(".//net")
        if net is None and len(root) > 0:
            net = root[0]  # First child is likely the net
        
        print(f"Net element found: {net is not None}")
        if net is not None:
            print(f"Net tag: {net.tag}")
        
        # Direct approach to get page
        page = None
        if net is not None:
            page = net.find(".//{%s}page" % nsmap['pnml'])
            if page is None:
                page = net.find(".//page")
            if page is None and len(net) > 0:
                for child in net:
                    if 'page' in child.tag.lower():
                        page = child
                        break
        
        print(f"Page element found: {page is not None}")
        if page is not None:
            print(f"Page tag: {page.tag}")
            print(f"Page has {len(page)} children")
            for i, child in enumerate(page):
                print(f"Child {i}: {child.tag}")
        
        # Process places - using direct approach with namespace
        if page is not None:
            places = page.findall(".//{%s}place" % nsmap['pnml'])
            if not places:
                places = page.findall(".//place")
            if not places:
                for child in page:
                    if 'place' in child.tag.lower():
                        places = [child]
                        break
            
            print(f"Found {len(places)} places")
            for place in places:
                try:
                    place_id = place.get('id')
                    print(f"Processing place with ID: {place_id}")
                    
                    # Get name
                    name = f"P{len(result['places']) + 1}"  # Default
                    name_elem = place.find(".//{%s}text" % nsmap['pnml'])
                    if name_elem is not None and name_elem.text:
                        name = name_elem.text
                    
                    # Get position
                    x, y = 0, 0  # Default
                    pos_elem = place.find(".//{%s}position" % nsmap['pnml'])
                    if pos_elem is not None:
                        x = int(float(pos_elem.get('x', 0)))
                        y = int(float(pos_elem.get('y', 0)))
                    
                    # Add to result
                    result['places'].append({
                        'id': place_id,
                        'name': name,
                        'x': x,
                        'y': y,
                        'tokens': 0  # Default
                    })
                except Exception as e:
                    print(f"Error processing place: {str(e)}")
                    traceback.print_exc()
        
        # Process transitions - using direct approach with namespace
        if page is not None:
            transitions = page.findall(".//{%s}transition" % nsmap['pnml'])
            if not transitions:
                transitions = page.findall(".//transition")
            if not transitions:
                for child in page:
                    if 'transition' in child.tag.lower():
                        transitions = [child]
                        break
            
            print(f"Found {len(transitions)} transitions")
            for transition in transitions:
                try:
                    transition_id = transition.get('id')
                    print(f"Processing transition with ID: {transition_id}")
                    
                    # Get name
                    name = f"T{len(result['transitions']) + 1}"  # Default
                    name_elem = transition.find(".//{%s}text" % nsmap['pnml'])
                    if name_elem is not None and name_elem.text:
                        name = name_elem.text
                    
                    # Get position
                    x, y = 0, 0  # Default
                    pos_elem = transition.find(".//{%s}position" % nsmap['pnml'])
                    if pos_elem is not None:
                        x = int(float(pos_elem.get('x', 0)))
                        y = int(float(pos_elem.get('y', 0)))
                    
                    # Add to result
                    result['transitions'].append({
                        'id': transition_id,
                        'name': name,
                        'x': x,
                        'y': y
                    })
                except Exception as e:
                    print(f"Error processing transition: {str(e)}")
                    traceback.print_exc()
        
        # Process arcs - using direct approach with namespace
        if page is not None:
            arcs = page.findall(".//{%s}arc" % nsmap['pnml'])
            if not arcs:
                arcs = page.findall(".//arc")
            if not arcs:
                for child in page:
                    if 'arc' in child.tag.lower():
                        arcs = [child]
                        break
            
            print(f"Found {len(arcs)} arcs")
            for arc in arcs:
                try:
                    arc_id = arc.get('id')
                    source_id = arc.get('source')
                    target_id = arc.get('target')
                    print(f"Processing arc: {arc_id}, source={source_id}, target={target_id}")
                    
                    # Skip if missing source or target
                    if not source_id or not target_id:
                        continue
                    
                    # Determine arc type based on existing places/transitions
                    source_is_place = any(p['id'] == source_id for p in result['places'])
                    target_is_place = any(p['id'] == target_id for p in result['places'])
                    
                    if source_is_place and not target_is_place:
                        arc_type = 'place-to-transition'
                    elif not source_is_place and target_is_place:
                        arc_type = 'transition-to-place'
                    else:
                        # Try to infer from IDs
                        if source_id.lower().startswith('p') and target_id.lower().startswith('t'):
                            arc_type = 'place-to-transition'
                        elif source_id.lower().startswith('t') and target_id.lower().startswith('p'):
                            arc_type = 'transition-to-place'
                        elif 'place' in source_id.lower() and 'transition' in target_id.lower():
                            arc_type = 'place-to-transition'
                        elif 'transition' in source_id.lower() and 'place' in target_id.lower():
                            arc_type = 'transition-to-place'
                        else:
                            print(f"Cannot determine arc type for {arc_id}")
                            continue
                    
                    # Get directions
                    source_direction = 'north'  # Default
                    target_direction = 'south'  # Default
                    
                    metadata = arc.find(".//{%s}metadata" % nsmap['pnml'])
                    if metadata is not None:
                        source_dir_elem = metadata.find(".//{%s}sourceDirection" % nsmap['pnml'])
                        target_dir_elem = metadata.find(".//{%s}targetDirection" % nsmap['pnml'])
                        
                        if source_dir_elem is not None and source_dir_elem.text:
                            source_direction = source_dir_elem.text
                        if target_dir_elem is not None and target_dir_elem.text:
                            target_direction = target_dir_elem.text
                    
                    # Add to result
                    result['arcs'].append({
                        'id': arc_id,
                        'source': source_id,
                        'target': target_id,
                        'type': arc_type,
                        'weight': 1,  # Default
                        'sourceDirection': source_direction,
                        'targetDirection': target_direction
                    })
                except Exception as e:
                    print(f"Error processing arc: {str(e)}")
                    traceback.print_exc()
        
        # Output the final result
        print("\n==================== PARSER RESULT ====================")
        print(json.dumps(result, indent=2))
        print("======================================================")
        print(f"Places: {len(result['places'])}")
        print(f"Transitions: {len(result['transitions'])}")
        print(f"Arcs: {len(result['arcs'])}")
        
        # Write result to a file
        with open('debug_result.json', 'w') as f:
            json.dump(result, f, indent=2)
        
        return result
    except Exception as e:
        print(f"Fatal error in debug_pnml_parsing: {str(e)}")
        traceback.print_exc()
        return None

# Run the debug function
debug_pnml_parsing()
