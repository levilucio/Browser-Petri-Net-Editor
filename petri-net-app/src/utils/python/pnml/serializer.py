"""Utilities for serializing editor JSON into PNML."""

from lxml import etree

from .constants import (
    DEFAULT_NET_ID,
    DEFAULT_NET_TYPE,
    DEFAULT_PAGE_ID,
    PNML_NAMESPACE,
)


def _append_place(page, place):
    place_id = place.get("id")
    place_elem = etree.SubElement(page, "place", id=place_id)

    name_elem = etree.SubElement(place_elem, "name")
    text_elem = etree.SubElement(name_elem, "text")
    text_elem.text = place.get("name", f"P{place_id}")

    graphics = etree.SubElement(place_elem, "graphics")
    etree.SubElement(
        graphics,
        "position",
        x=str(place.get("x", 0)),
        y=str(place.get("y", 0)),
    )

    tokens = place.get("tokens", 0)
    if tokens > 0:
        marking = etree.SubElement(place_elem, "initialMarking")
        marking_text = etree.SubElement(marking, "text")
        marking_text.text = str(tokens)


def _append_transition(page, transition):
    transition_id = transition.get("id")
    transition_elem = etree.SubElement(page, "transition", id=transition_id)

    name_elem = etree.SubElement(transition_elem, "name")
    text_elem = etree.SubElement(name_elem, "text")
    text_elem.text = transition.get("name", f"T{transition_id}")

    graphics = etree.SubElement(transition_elem, "graphics")
    etree.SubElement(
        graphics,
        "position",
        x=str(transition.get("x", 0)),
        y=str(transition.get("y", 0)),
    )


def _append_arc(page, arc):
    arc_elem = etree.SubElement(
        page,
        "arc",
        id=arc.get("id"),
        source=arc.get("source"),
        target=arc.get("target"),
    )

    graphics = etree.SubElement(arc_elem, "graphics")
    metadata = etree.SubElement(graphics, "metadata")

    source_direction = etree.SubElement(metadata, "sourceDirection")
    source_direction.text = arc.get("sourceDirection", "north")

    target_direction = etree.SubElement(metadata, "targetDirection")
    target_direction.text = arc.get("targetDirection", "south")

    weight = arc.get("weight", 1)
    if weight > 1:
        inscription = etree.SubElement(arc_elem, "inscription")
        inscription_text = etree.SubElement(inscription, "text")
        inscription_text.text = str(weight)


def json_to_pnml(petri_net_json):
    """Convert the editor's JSON representation to a PNML XML string."""

    nsmap = {None: PNML_NAMESPACE}
    pnml = etree.Element("pnml", nsmap=nsmap)

    net = etree.SubElement(
        pnml,
        "net",
        id=DEFAULT_NET_ID,
        type=DEFAULT_NET_TYPE,
    )

    net_name = etree.SubElement(net, "name")
    net_name_text = etree.SubElement(net_name, "text")
    net_name_text.text = "Petri Net"

    page = etree.SubElement(net, "page", id=DEFAULT_PAGE_ID)

    for place in petri_net_json.get("places", []):
        _append_place(page, place)

    for transition in petri_net_json.get("transitions", []):
        _append_transition(page, transition)

    for arc in petri_net_json.get("arcs", []):
        _append_arc(page, arc)

    return etree.tostring(pnml, pretty_print=True, encoding="unicode")


__all__ = ["json_to_pnml"]


