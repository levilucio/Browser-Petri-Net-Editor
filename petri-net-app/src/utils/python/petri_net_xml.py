"""Compatibility shim that re-exports PNML parser/serializer helpers."""

from .pnml import json_to_pnml, pnml_to_json

__all__ = ["json_to_pnml", "pnml_to_json"]
