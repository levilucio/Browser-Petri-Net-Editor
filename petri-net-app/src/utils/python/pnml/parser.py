"""Utilities for parsing PNML XML into editor JSON."""

from lxml import etree
import traceback

from .constants import PNML_NAMESPACE


def _debug(message):
    print(message)


def _determine_namespace(root):
    ns_uri = PNML_NAMESPACE
    _debug(f"Root tag: {root.tag}")

    if None in root.nsmap:
        ns_uri = root.nsmap[None]
        _debug(f"Using default namespace as pnml: {ns_uri}")
    else:
        _debug("Using standard PNML namespace")

    if "{" in root.tag:
        extracted = root.tag.split("}")[0][1:]
        ns_uri = extracted
        _debug(f"Extracted namespace URI from root tag: {ns_uri}")

    return ns_uri


def _tag_bundle(ns_uri, local_name):
    return {
        "ns": f"{{{ns_uri}}}{local_name}",
        "local": local_name,
    }


def _collect_with_namespace(container, bundle, label):
    nodes = []
    try:
        nodes = container.xpath(f".//{bundle['ns']}")
        _debug(f"Found {len(nodes)} {label} with namespace")
    except Exception as error:
        _debug(f"Error finding {label} with namespace: {error}")

    if nodes:
        return nodes

    try:
        nodes = [elem for elem in container if elem.tag.endswith(bundle["local"])]
        _debug(f"Found {len(nodes)} {label} by tag ending")
    except Exception as error:
        _debug(f"Error finding {label} by tag ending: {error}")

    return nodes


def _collect_descendants(element, bundle):
    nodes = element.xpath(f".//{bundle['ns']}")
    if nodes:
        return nodes
    return [node for node in element.xpath(".//*") if node.tag.endswith(bundle["local"])]


def _find_page(root, ns_uri):
    for child in root:
        if child.tag.endswith("net"):
            _debug(f"Found net element: {child.tag}")
            for net_child in child:
                if net_child.tag.endswith("page"):
                    _debug(f"Found page element: {net_child.tag}")
                    return net_child

    page_xpath = f"//{{{ns_uri}}}page"
    candidates = root.xpath(page_xpath)
    if candidates:
        page = candidates[0]
        _debug(f"Found page using XPath: {page.tag}")
        return page

    _debug("Still no page found, using fallback")
    for elem in root.xpath("//*"):
        if elem.tag.endswith("page"):
            _debug(f"Found page by tag ending: {elem.tag}")
            return elem

    _debug("Unable to find page element, returning None")
    return None


def _parse_place(place, bundles, result):
    place_id = place.get("id")
    _debug(f"Processing place: {place_id}")

    name = f"P{len(result['places']) + 1}"
    name_nodes = _collect_descendants(place, bundles["text"])
    if name_nodes and name_nodes[0].text:
        name = name_nodes[0].text

    x = y = 0
    position_nodes = _collect_descendants(place, bundles["position"])
    if position_nodes:
        x = int(float(position_nodes[0].get("x", 0)))
        y = int(float(position_nodes[0].get("y", 0)))

    tokens = 0
    marking_xpath = f".//{bundles['initial_marking']['ns']}/{bundles['text']['ns']}"
    marking_nodes = place.xpath(marking_xpath)
    if not marking_nodes:
        for elem in place.xpath(".//*"):
            if elem.tag.endswith("initialMarking"):
                for child in elem.xpath(".//*"):
                    if child.tag.endswith("text") and child.text:
                        try:
                            tokens = int(child.text)
                            break
                        except Exception:  # noqa: BLE001
                            pass
    elif marking_nodes[0].text:
        try:
            tokens = int(marking_nodes[0].text)
        except Exception:  # noqa: BLE001
            tokens = 0

    place_obj = {
        "id": place_id,
        "name": name,
        "x": x,
        "y": y,
        "tokens": tokens,
    }
    _debug(f"Added place: {place_obj}")
    result["places"].append(place_obj)


def _parse_transition(transition, bundles, result):
    transition_id = transition.get("id")
    _debug(f"Processing transition: {transition_id}")

    name = f"T{len(result['transitions']) + 1}"
    name_nodes = _collect_descendants(transition, bundles["text"])
    if name_nodes and name_nodes[0].text:
        name = name_nodes[0].text

    x = y = 0
    position_nodes = _collect_descendants(transition, bundles["position"])
    if position_nodes:
        x = int(float(position_nodes[0].get("x", 0)))
        y = int(float(position_nodes[0].get("y", 0)))

    transition_obj = {
        "id": transition_id,
        "name": name,
        "x": x,
        "y": y,
    }
    _debug(f"Added transition: {transition_obj}")
    result["transitions"].append(transition_obj)


def _arc_type(source_id, target_id, places):
    source_is_place = any(place["id"] == source_id for place in places)
    target_is_place = any(place["id"] == target_id for place in places)

    if source_is_place and not target_is_place:
        return "place-to-transition"
    if target_is_place and not source_is_place:
        return "transition-to-place"
    if "place" in source_id.lower() and "transition" in target_id.lower():
        return "place-to-transition"
    if "transition" in source_id.lower() and "place" in target_id.lower():
        return "transition-to-place"
    if source_id.lower().startswith("p") and target_id.lower().startswith("t"):
        return "place-to-transition"
    if source_id.lower().startswith("t") and target_id.lower().startswith("p"):
        return "transition-to-place"
    _debug(f"Cannot determine arc type for {source_id}->{target_id}")
    return None


def _parse_arc(arc, bundles, result):
    arc_id = arc.get("id")
    source_id = arc.get("source")
    target_id = arc.get("target")

    _debug(f"Processing arc: {arc_id}, source={source_id}, target={target_id}")

    if not source_id or not target_id:
        _debug(f"Skipping arc {arc_id} due to missing source or target")
        return

    arc_type = _arc_type(source_id, target_id, result["places"])
    if arc_type is None:
        return

    source_direction = "north"
    target_direction = "south"

    metadata_nodes = _collect_descendants(arc, bundles["metadata"])
    if metadata_nodes:
        metadata = metadata_nodes[0]
        source_dir_nodes = _collect_descendants(metadata, bundles["source_direction"])
        target_dir_nodes = _collect_descendants(metadata, bundles["target_direction"])

        if source_dir_nodes and source_dir_nodes[0].text:
            source_direction = source_dir_nodes[0].text
        if target_dir_nodes and target_dir_nodes[0].text:
            target_direction = target_dir_nodes[0].text

    weight = 1
    inscription_xpath = f".//{bundles['inscription']['ns']}/{bundles['text']['ns']}"
    inscription_nodes = arc.xpath(inscription_xpath)
    if not inscription_nodes:
        for elem in arc.xpath(".//*"):
            if elem.tag.endswith("inscription"):
                for child in elem.xpath(".//*"):
                    if child.tag.endswith("text") and child.text:
                        try:
                            weight = int(child.text)
                            break
                        except Exception:  # noqa: BLE001
                            pass
    elif inscription_nodes[0].text:
        try:
            weight = int(inscription_nodes[0].text)
        except Exception:  # noqa: BLE001
            weight = 1

    arc_obj = {
        "id": arc_id,
        "source": source_id,
        "target": target_id,
        "type": arc_type,
        "weight": weight,
        "sourceDirection": source_direction,
        "targetDirection": target_direction,
    }
    _debug(f"Added arc: {arc_obj}")
    result["arcs"].append(arc_obj)


def pnml_to_json(pnml_string):
    """Convert PNML XML string to the editor's JSON representation."""

    result = {"places": [], "transitions": [], "arcs": []}

    try:
        parser = etree.XMLParser(remove_blank_text=True)
        root = etree.fromstring(pnml_string.encode("utf-8"), parser)
        ns_uri = _determine_namespace(root)

        bundles = {
            "place": _tag_bundle(ns_uri, "place"),
            "transition": _tag_bundle(ns_uri, "transition"),
            "arc": _tag_bundle(ns_uri, "arc"),
            "text": _tag_bundle(ns_uri, "text"),
            "position": _tag_bundle(ns_uri, "position"),
            "metadata": _tag_bundle(ns_uri, "metadata"),
            "source_direction": _tag_bundle(ns_uri, "sourceDirection"),
            "target_direction": _tag_bundle(ns_uri, "targetDirection"),
            "inscription": _tag_bundle(ns_uri, "inscription"),
            "initial_marking": _tag_bundle(ns_uri, "initialMarking"),
        }

        page = _find_page(root, ns_uri)
        if page is None:
            _debug("Unable to find page element, returning empty result")
            return result

        _debug("Processing places...")
        for place in _collect_with_namespace(page, bundles["place"], "places"):
            try:
                _parse_place(place, bundles, result)
            except Exception as error:  # noqa: BLE001
                _debug(f"Error processing place: {error}")
                traceback.print_exc()

        _debug("Processing transitions...")
        for transition in _collect_with_namespace(page, bundles["transition"], "transitions"):
            try:
                _parse_transition(transition, bundles, result)
            except Exception as error:  # noqa: BLE001
                _debug(f"Error processing transition: {error}")
                traceback.print_exc()

        _debug("Processing arcs...")
        for arc in _collect_with_namespace(page, bundles["arc"], "arcs"):
            try:
                _parse_arc(arc, bundles, result)
            except Exception as error:  # noqa: BLE001
                _debug(f"Error processing arc: {error}")
                traceback.print_exc()

        _debug(
            f"Final result: {len(result['places'])} places, "
            f"{len(result['transitions'])} transitions, {len(result['arcs'])} arcs",
        )
        return result

    except Exception as error:  # noqa: BLE001
        _debug(f"Error in pnml_to_json: {error}")
        traceback.print_exc()
        return result


__all__ = ["pnml_to_json"]


