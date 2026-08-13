"""
Seller bulk-order file parsers - CSV / Excel / Word (Layer 6).

Placeholder architecture. Sellers upload order lists through the seller portal;
those files are currently stored as-is (app.models.seller_upload). This module
will later:

    - detect file type by extension/magic bytes
    - parse rows (order_no, receiver, city, COD amount, ...)
    - batch-create draft orders + run risk_engine.batch_score()

Contract below keeps the parser pluggable - the seller upload endpoint does NOT
need to change when real parsing lands.
"""
from typing import Any


def parse_upload(file_path: str, file_type: str | None = None) -> list[dict[str, Any]]:
    """Placeholder: returns a list of parsed order rows."""
    return []


def row_count(file_path: str, file_type: str | None = None) -> int | None:
    """Placeholder: returns the number of data rows in the file."""
    return None
