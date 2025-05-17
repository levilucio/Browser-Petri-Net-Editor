"""
XML Parser/Serializer for Petri Nets using lxml (Pyodide)
This module provides functions to convert between the Petri net editor's internal
JSON representation and standard PNML (Petri Net Markup Language) XML format.
"""
from lxml import etree
import traceback

def json_to_pnml(petri_net_json):
    """
    Convert the Petri net editor's JSON representation to PNML XML string.
    
    Args:
        petri_net_json (dict): The Petri net in JSON format with places, transitions, and arcs
        
    Returns:
        str: PNML XML representation of the Petri net
    """
    # Create the PNML structure
    nsmap = {None: "http://www.pnml.org/version-2009/grammar/pnml"}
    pnml = etree.Element("pnml", nsmap=nsmap)
    
    # Create the net element
    net = etree.SubElement(pnml, "net", id="net1", type="http://www.pnml.org/version-2009/grammar/ptnet")
    
    # Add net name
    net_name = etree.SubElement(net, "name")
    net_name_text = etree.SubElement(net_name, "text")
    net_name_text.text = "Petri Net"
    
    # Create the page element
    page = etree.SubElement(net, "page", id="page1")
    
    # Process places
    for place in petri_net_json.get('places', []):
        place_id = place.get('id')
        place_elem = etree.SubElement(page, "place", id=place_id)
        
        # Add name
        name = etree.SubElement(place_elem, "name")
        text = etree.SubElement(name, "text")
        text.text = place.get('name', f"P{place_id}")
        
        # Add graphics (position)
        graphics = etree.SubElement(place_elem, "graphics")
        position = etree.SubElement(graphics, "position", x=str(place.get('x', 0)), y=str(place.get('y', 0)))
        
        # Add initial marking (tokens)
        if place.get('tokens', 0) > 0:
            marking = etree.SubElement(place_elem, "initialMarking")
            marking_text = etree.SubElement(marking, "text")
            marking_text.text = str(place.get('tokens', 0))
    
    # Process transitions
    for transition in petri_net_json.get('transitions', []):
        transition_id = transition.get('id')
        transition_elem = etree.SubElement(page, "transition", id=transition_id)
        
        # Add name
        name = etree.SubElement(transition_elem, "name")
        text = etree.SubElement(name, "text")
        text.text = transition.get('name', f"T{transition_id}")
        
        # Add graphics (position)
        graphics = etree.SubElement(transition_elem, "graphics")
        position = etree.SubElement(graphics, "position", x=str(transition.get('x', 0)), y=str(transition.get('y', 0)))
    
    # Process arcs
    for arc in petri_net_json.get('arcs', []):
        arc_id = arc.get('id')
        source_id = arc.get('source')
        target_id = arc.get('target')
        
        arc_elem = etree.SubElement(page, "arc", id=arc_id, source=source_id, target=target_id)
        
        # Add graphics with metadata for source and target directions
        graphics = etree.SubElement(arc_elem, "graphics")
        metadata = etree.SubElement(graphics, "metadata")
        
        source_direction = etree.SubElement(metadata, "sourceDirection")
        source_direction.text = arc.get('sourceDirection', 'north')
        
        target_direction = etree.SubElement(metadata, "targetDirection")
        target_direction.text = arc.get('targetDirection', 'south')
        
        # Add inscription (weight) if > 1
        if arc.get('weight', 1) > 1:
            inscription = etree.SubElement(arc_elem, "inscription")
            inscription_text = etree.SubElement(inscription, "text")
            inscription_text.text = str(arc.get('weight', 1))
    
    # Convert to string
    return etree.tostring(pnml, pretty_print=True, encoding='unicode')

def pnml_to_json(pnml_string):
    """
    Convert PNML XML string to the Petri net editor's JSON representation.
    
    Args:
        pnml_string (str): PNML XML representation of the Petri net
        
    Returns:
        dict: The Petri net in JSON format with places, transitions, and arcs
    """
    # Initialize the result structure
    result = {
        'places': [],
        'transitions': [],
        'arcs': []
    }
    
    try:
        # Parse the XML string
        parser = etree.XMLParser(remove_blank_text=True)
        root = etree.fromstring(pnml_string.encode('utf-8'), parser)
        
        print(f"Root tag: {root.tag}")
        
        # Handle namespace explicitly
        nsmap = {}
        if None in root.nsmap:
            nsmap['pnml'] = root.nsmap[None]
            print(f"Using default namespace as pnml: {nsmap['pnml']}")
        else:
            nsmap['pnml'] = "http://www.pnml.org/version-2009/grammar/pnml"
            print("Using standard PNML namespace")
        
        # The namespace URI is in the root.tag if a default namespace is used
        ns_uri = None
        if '{' in root.tag:
            ns_uri = root.tag.split('}')[0][1:]
            nsmap['pnml'] = ns_uri
            print(f"Extracted namespace URI from root tag: {ns_uri}")
        
        # Fixed lookups with namespace awareness
        NS = "{%s}" % nsmap['pnml']
        PLACE_TAG = f"{NS}place"
        TRANSITION_TAG = f"{NS}transition"
        ARC_TAG = f"{NS}arc"
        TEXT_TAG = f"{NS}text"
        POSITION_TAG = f"{NS}position"
        METADATA_TAG = f"{NS}metadata"
        SOURCE_DIRECTION_TAG = f"{NS}sourceDirection"
        TARGET_DIRECTION_TAG = f"{NS}targetDirection"
        
        # Find the page element
        page = None
        
        # First look for the net element
        for child in root:
            if child.tag.endswith('net'):
                print(f"Found net element: {child.tag}")
                # Look for the page in the net
                for net_child in child:
                    if net_child.tag.endswith('page'):
                        page = net_child
                        print(f"Found page element: {page.tag}")
                        break
                if page is not None:
                    break
        
        if page is None:
            print("No page element found, using direct search")
            # Try direct approach with namespace
            page_xpath = f"//{NS}page"
            pages = root.xpath(page_xpath)
            if pages:
                page = pages[0]
                print(f"Found page using XPath: {page.tag}")
        
        if page is None:
            print("Still no page found, using fallback")
            # Last resort - find any element that ends with 'page'
            all_elems = root.xpath("//*")
            for elem in all_elems:
                if elem.tag.endswith('page'):
                    page = elem
                    print(f"Found page by tag ending: {page.tag}")
                    break
        
        if page is None:
            print("Unable to find page element, returning empty result")
            return result
        
        # Process places
        print("Processing places...")
        places = []
        
        # Try with namespace
        places_xpath = f".//{NS}place"
        try:
            places = page.xpath(places_xpath)
            print(f"Found {len(places)} places with namespace")
        except Exception as e:
            print(f"Error finding places with namespace: {e}")
        
        # If no places found, try without namespace
        if not places:
            try:
                places = [elem for elem in page if elem.tag.endswith('place')]
                print(f"Found {len(places)} places by tag ending")
            except Exception as e:
                print(f"Error finding places by tag ending: {e}")
        
        for place in places:
            try:
                place_id = place.get('id')
                print(f"Processing place: {place_id}")
                
                # Get name
                name = f"P{len(result['places']) + 1}"  # Default
                name_texts = place.xpath(f".//{NS}text")
                if not name_texts:
                    name_texts = [elem for elem in place.xpath(".//*") if elem.tag.endswith('text')]
                
                if name_texts and name_texts[0].text:
                    name = name_texts[0].text
                
                # Get position
                x, y = 0, 0  # Default
                position_elems = place.xpath(f".//{NS}position")
                if not position_elems:
                    position_elems = [elem for elem in place.xpath(".//*") if elem.tag.endswith('position')]
                
                if position_elems:
                    x = int(float(position_elems[0].get('x', 0)))
                    y = int(float(position_elems[0].get('y', 0)))
                
                # Get initial marking (tokens)
                tokens = 0  # Default
                marking_texts = place.xpath(f".//{NS}initialMarking/{NS}text")
                if not marking_texts:
                    for elem in place.xpath(".//*"):
                        if elem.tag.endswith('initialMarking'):
                            for child in elem.xpath(".//*"):
                                if child.tag.endswith('text') and child.text:
                                    try:
                                        tokens = int(child.text)
                                        break
                                    except:
                                        pass
                
                # Create place object
                place_obj = {
                    'id': place_id,
                    'name': name,
                    'x': x,
                    'y': y,
                    'tokens': tokens
                }
                
                print(f"Added place: {place_obj}")
                result['places'].append(place_obj)
            except Exception as e:
                print(f"Error processing place: {e}")
                traceback.print_exc()
        
        # Process transitions
        print("Processing transitions...")
        transitions = []
        
        # Try with namespace
        transitions_xpath = f".//{NS}transition"
        try:
            transitions = page.xpath(transitions_xpath)
            print(f"Found {len(transitions)} transitions with namespace")
        except Exception as e:
            print(f"Error finding transitions with namespace: {e}")
        
        # If no transitions found, try without namespace
        if not transitions:
            try:
                transitions = [elem for elem in page if elem.tag.endswith('transition')]
                print(f"Found {len(transitions)} transitions by tag ending")
            except Exception as e:
                print(f"Error finding transitions by tag ending: {e}")
        
        for transition in transitions:
            try:
                transition_id = transition.get('id')
                print(f"Processing transition: {transition_id}")
                
                # Get name
                name = f"T{len(result['transitions']) + 1}"  # Default
                name_texts = transition.xpath(f".//{NS}text")
                if not name_texts:
                    name_texts = [elem for elem in transition.xpath(".//*") if elem.tag.endswith('text')]
                
                if name_texts and name_texts[0].text:
                    name = name_texts[0].text
                
                # Get position
                x, y = 0, 0  # Default
                position_elems = transition.xpath(f".//{NS}position")
                if not position_elems:
                    position_elems = [elem for elem in transition.xpath(".//*") if elem.tag.endswith('position')]
                
                if position_elems:
                    x = int(float(position_elems[0].get('x', 0)))
                    y = int(float(position_elems[0].get('y', 0)))
                
                # Create transition object
                transition_obj = {
                    'id': transition_id,
                    'name': name,
                    'x': x,
                    'y': y
                }
                
                print(f"Added transition: {transition_obj}")
                result['transitions'].append(transition_obj)
            except Exception as e:
                print(f"Error processing transition: {e}")
                traceback.print_exc()
        
        # Process arcs
        print("Processing arcs...")
        arcs = []
        
        # Try with namespace
        arcs_xpath = f".//{NS}arc"
        try:
            arcs = page.xpath(arcs_xpath)
            print(f"Found {len(arcs)} arcs with namespace")
        except Exception as e:
            print(f"Error finding arcs with namespace: {e}")
        
        # If no arcs found, try without namespace
        if not arcs:
            try:
                arcs = [elem for elem in page if elem.tag.endswith('arc')]
                print(f"Found {len(arcs)} arcs by tag ending")
            except Exception as e:
                print(f"Error finding arcs by tag ending: {e}")
        
        for arc in arcs:
            try:
                arc_id = arc.get('id')
                source_id = arc.get('source')
                target_id = arc.get('target')
                
                print(f"Processing arc: {arc_id}, source={source_id}, target={target_id}")
                
                # Skip if missing source or target
                if not source_id or not target_id:
                    print(f"Skipping arc {arc_id} due to missing source or target")
                    continue
                
                # Determine arc type based on existing places/transitions or ID patterns
                source_is_place = any(p['id'] == source_id for p in result['places'])
                target_is_place = any(p['id'] == target_id for p in result['places'])
                
                if source_is_place and not target_is_place:
                    arc_type = 'place-to-transition'
                elif not source_is_place and target_is_place:
                    arc_type = 'transition-to-place'
                else:
                    # Try to infer from IDs
                    if 'place' in source_id.lower() and 'transition' in target_id.lower():
                        arc_type = 'place-to-transition'
                    elif 'transition' in source_id.lower() and 'place' in target_id.lower():
                        arc_type = 'transition-to-place'
                    elif source_id.lower().startswith('p') and target_id.lower().startswith('t'):
                        arc_type = 'place-to-transition'
                    elif source_id.lower().startswith('t') and target_id.lower().startswith('p'):
                        arc_type = 'transition-to-place'
                    else:
                        print(f"Cannot determine arc type for {arc_id}")
                        continue
                
                # Get directions from metadata
                source_direction = 'north'  # Default
                target_direction = 'south'  # Default
                
                # Find metadata element
                metadata_elems = arc.xpath(f".//{NS}metadata")
                if not metadata_elems:
                    metadata_elems = [elem for elem in arc.xpath(".//*") if elem.tag.endswith('metadata')]
                
                if metadata_elems:
                    metadata = metadata_elems[0]
                    
                    # Find direction elements
                    source_dir_elems = metadata.xpath(f".//{NS}sourceDirection")
                    if not source_dir_elems:
                        source_dir_elems = [elem for elem in metadata.xpath(".//*") if elem.tag.endswith('sourceDirection')]
                    
                    target_dir_elems = metadata.xpath(f".//{NS}targetDirection")
                    if not target_dir_elems:
                        target_dir_elems = [elem for elem in metadata.xpath(".//*") if elem.tag.endswith('targetDirection')]
                    
                    if source_dir_elems and source_dir_elems[0].text:
                        source_direction = source_dir_elems[0].text
                    
                    if target_dir_elems and target_dir_elems[0].text:
                        target_direction = target_dir_elems[0].text
                
                # Get weight (inscription)
                weight = 1  # Default
                inscription_texts = arc.xpath(f".//{NS}inscription/{NS}text")
                if not inscription_texts:
                    for elem in arc.xpath(".//*"):
                        if elem.tag.endswith('inscription'):
                            for child in elem.xpath(".//*"):
                                if child.tag.endswith('text') and child.text:
                                    try:
                                        weight = int(child.text)
                                        break
                                    except:
                                        pass
                
                # Create arc object
                arc_obj = {
                    'id': arc_id,
                    'source': source_id,
                    'target': target_id,
                    'type': arc_type,
                    'weight': weight,
                    'sourceDirection': source_direction,
                    'targetDirection': target_direction
                }
                
                print(f"Added arc: {arc_obj}")
                result['arcs'].append(arc_obj)
            except Exception as e:
                print(f"Error processing arc: {e}")
                traceback.print_exc()
        
        print(f"Final result: {len(result['places'])} places, {len(result['transitions'])} transitions, {len(result['arcs'])} arcs")
        return result
    
    except Exception as e:
        print(f"Error in pnml_to_json: {e}")
        traceback.print_exc()
        return result  # Return the empty result on error
