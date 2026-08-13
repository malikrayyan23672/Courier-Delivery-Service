"""
COD engine - settlement orchestration.

Placeholder architecture. The concrete settlement/payout flow already lives in
app/services/settlement_service.py (T+1, wallet auto-lock, reconciliation).
This module is where the *intelligent* decisions would later be layered on:

    - dynamic payout scheduling (batch payouts, thresholds)
    - anomaly-driven wallet auto-locking based on risk_engine output
    - payout via bank/Stripe when a gateway is integrated

Keep settlement_service.py as the source of truth for now.
"""


def should_auto_lock_wallet(business, risk_profile: dict) -> bool:
    """Placeholder: a wallet should auto-lock when reconciliation or risk flags it."""
    return risk_profile.get("risk_score", 0) >= 0.8


def estimate_payout_schedule(settlements: list) -> list[dict]:
    """Placeholder: describe when each settlement will be paid (T+1 model)."""
    return [
        {
            "settlement_id": str(s.id),
            "amount": s.amount,
            "due_on": s.settle_due_on,
            "status": s.status.value if hasattr(s.status, "value") else s.status,
        }
        for s in settlements
    ]
