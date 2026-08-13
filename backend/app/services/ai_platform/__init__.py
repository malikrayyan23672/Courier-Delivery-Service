"""
Layer 5 - AI Platform (architecture placeholder).

This package exists to define WHERE the intelligence layer will live and WHAT
it will own, so the rest of the system is built against stable seams:

    risk_engine      - COD risk scoring (predicts RTO / fraud likelihood)
    cod_engine       - COD settlement orchestration (T+1 payouts)
    command_centre   - logistics command centre aggregation APIs
    parsers          - parse seller-uploaded CSV/Excel/Doc bulk order lists

The callers (admin analytics, seller portal) already talk to ordinary routers;
swapping the *implementation* of these functions later for real ML / pipelines
should not require changing any API contract.
"""
