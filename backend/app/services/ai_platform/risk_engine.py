"""
COD risk scoring - RTO (return-to-origin) prediction and fraud detection.

Placeholder architecture. Future implementation would:
  1. Train a model on historical Order + Payment + RNP features
  2. Expose `score_order()` for real-time pre-dispatch screening
  3. Expose `batch_score()` for seller bulk-order lists

The function signatures below are the contract the rest of the codebase will
call. Keep them stable; the bodies can change freely behind them.
"""
from typing import Any


def score_order(db, order) -> dict[str, Any]:
    """
    Returns a risk profile for a single order:
        {
            "risk_score": 0.0..1.0,
            "rto_probability": 0.0..1.0,
            "fraud_flags": [...],
            "recommendation": "proceed" | "verify" | "hold",
        }
    Placeholder: rule-based defaults so callers always have a shape to render.
    """
    return {
        "risk_score": 0.1,
        "rto_probability": 0.02,
        "fraud_flags": [],
        "recommendation": "proceed",
    }


def batch_score(db, seller_upload_id: str) -> list[dict[str, Any]]:
    """
    Scores every order parsed from a seller upload. Placeholder - will be
    driven by the parsers module + an ML pipeline in production.
    """
    return []
