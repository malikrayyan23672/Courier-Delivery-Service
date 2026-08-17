from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.business import Business
from app.models.route import Route
from app.models.zone import Zone
from app.models.pricing_rule import PricingRule
from app.models.audit_log import AuditLog
from app.models.branch import Branch
from app.models.order import Order, OrderStatus
from app.services import log_service

router = APIRouter(prefix="/admin", tags=["Admin - Network"])


def _status_value(status) -> str:
    return status.value if hasattr(status, "value") else status


# ---------------------------------------------------------------
# CORRIDORS - active city-to-city corridors with performance metrics
# ---------------------------------------------------------------
@router.get("/corridors")
def list_corridors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "manager")),
):
    """Active corridors (origin -> destination) with live performance metrics
    derived from order volume on that leg (either direction)."""
    routes = db.query(Route).filter(Route.is_active.is_(True)).all()
    orders = db.query(Order).options(joinedload(Order.pickup_address), joinedload(Order.dropoff_address)).all()

    out = []
    for route in routes:
        both = [
            o for o in orders
            if o.pickup_address and o.dropoff_address
            and (
                (o.pickup_address.city == route.origin and o.dropoff_address.city == route.destination)
                or (o.pickup_address.city == route.destination and o.dropoff_address.city == route.origin)
            )
        ]
        delivered = [o for o in both if _status_value(o.status) == "delivered"]
        rto = [o for o in both if _status_value(o.status) == "rto"]
        in_transit = [o for o in both if _status_value(o.status) in ("in_transit", "picked_up", "assigned", "created", "out_for_delivery")]

        total_hours = 0.0
        for o in delivered:
            created = o.created_at
            if created and o.updated_at:
                hours = (o.updated_at - created).total_seconds() / 3600.0
                total_hours += max(hours, 0.0)

        avg_hours = round(total_hours / len(delivered), 1) if delivered else None
        delivery_rate = round((len(delivered) / len(both)) * 100, 1) if both else 0.0

        origin_zone = db.query(Zone).filter(func.lower(Zone.name) == route.origin.lower()).first()
        out.append({
            "id": str(route.id),
            "origin": route.origin,
            "destination": route.destination,
            "distance_km": route.distance_km,
            "estimated_time_min": route.estimated_time_min,
            "is_active": route.is_active,
            "base_rate": origin_zone.base_rate if origin_zone else None,
            "total_orders": len(both),
            "delivered": len(delivered),
            "rto": len(rto),
            "in_transit": len(in_transit),
            "delivery_rate": delivery_rate,
            "avg_delivery_hours": avg_hours,
        })

    return out


class CorridorIn(BaseModel):
    origin: str
    destination: str
    distance_km: int
    estimated_time_min: int
    is_active: Optional[bool] = True


@router.post("/corridors", status_code=201)
def create_corridor(
    payload: CorridorIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    origin = payload.origin.strip()
    destination = payload.destination.strip()
    if not origin or not destination:
        raise HTTPException(status_code=400, detail="Origin and destination are required")
    if origin.lower() == destination.lower():
        raise HTTPException(status_code=400, detail="Origin and destination must be different")
    existing = (
        db.query(Route)
        .filter(func.lower(Route.origin) == origin.lower(), func.lower(Route.destination) == destination.lower())
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="This corridor already exists")
    route = Route(
        origin=origin, destination=destination,
        distance_km=payload.distance_km, estimated_time_min=payload.estimated_time_min,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    log_service.create_log(
        db, action="corridor_created", user_id=str(current_user.id),
        entity_type="Route", entity_id=str(route.id), details=f"{origin} -> {destination}",
    )
    db.commit()
    return {"id": str(route.id), "origin": route.origin, "destination": route.destination,
            "distance_km": route.distance_km, "estimated_time_min": route.estimated_time_min, "is_active": route.is_active}


@router.patch("/corridors/{corridor_id}")
def update_corridor(
    corridor_id: str,
    payload: CorridorIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    route = db.query(Route).filter(Route.id == corridor_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Corridor not found")
    route.origin = payload.origin.strip()
    route.destination = payload.destination.strip()
    route.distance_km = payload.distance_km
    route.estimated_time_min = payload.estimated_time_min
    if payload.is_active is not None:
        route.is_active = payload.is_active
    db.commit()
    db.refresh(route)
    log_service.create_log(
        db, action="corridor_updated", user_id=str(current_user.id),
        entity_type="Route", entity_id=str(route.id),
        details=f"{route.origin} -> {route.destination}, active={route.is_active}",
    )
    db.commit()
    return {"id": str(route.id), "origin": route.origin, "destination": route.destination,
            "distance_km": route.distance_km, "estimated_time_min": route.estimated_time_min, "is_active": route.is_active}


@router.get("/corridors/map")
def corridor_map_hubs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin", "manager")),
):
    """Hub pins for the live corridor map - every active branch with its
    coordinates and current parcel load."""
    branches = db.query(Branch).filter(Branch.status == "active").all()
    now = datetime.now(timezone.utc).date()
    out = []
    for b in branches:
        branch_orders = (
            db.query(Order)
            .filter(Order.branch_id == b.id)
            .all()
        )
        out.append({
            "id": str(b.id),
            "name": b.name,
            "address": b.address,
            "zone_name": b.zone.name if b.zone else None,
            "latitude": float(b.latitude) if b.latitude else None,
            "longitude": float(b.longitude) if b.longitude else None,
            "in_transit": sum(1 for o in branch_orders if _status_value(o.status) in ("in_transit", "out_for_delivery", "picked_up")),
            "delivered_today": sum(1 for o in branch_orders if _status_value(o.status) == "delivered" and o.updated_at and o.updated_at.date() == now),
            "total_parcels": len(branch_orders),
        })
    return out


# ---------------------------------------------------------------
# PRICING - base rate + COD fee per corridor, weight slabs per corridor
# ---------------------------------------------------------------
class ZonePricingUpdateIn(BaseModel):
    base_rate: Optional[float] = None
    cod_fee_percentage: Optional[float] = None


class PricingRuleIn(BaseModel):
    zone_id: str
    weight_range_min: int
    weight_range_max: int
    price: float
    extra_per_kg: Optional[float] = None
    fuel_surcharge_percentage: Optional[float] = None
    tax_percentage: Optional[float] = None


@router.get("/pricing")
def pricing_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    """Per-corridor (zone) base rate, COD fee % and configured weight slabs."""
    zones = db.query(Zone).all()
    rules = db.query(PricingRule).all()
    by_zone: dict[str, list] = {}
    for r in rules:
        by_zone.setdefault(str(r.zone_id), []).append({
            "id": str(r.id),
            "weight_range_min": r.weight_range_min,
            "weight_range_max": r.weight_range_max,
            "price": r.price,
            "extra_per_kg": r.extra_per_kg,
            "fuel_surcharge_percentage": r.fuel_surcharge_percentage,
            "tax_percentage": r.tax_percentage,
        })
    return [
        {
            "zone_id": str(z.id),
            "name": z.name,
            "description": z.description,
            "is_active": z.is_active,
            "base_rate": z.base_rate,
            "cod_fee_percentage": z.cod_fee_percentage,
            "weight_slabs": by_zone.get(str(z.id), []),
        }
        for z in zones
    ]


@router.patch("/pricing/zones/{zone_id}")
def update_zone_pricing(
    zone_id: str,
    payload: ZonePricingUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Corridor not found")
    if payload.base_rate is not None:
        if payload.base_rate < 0:
            raise HTTPException(status_code=400, detail="Base rate must be positive")
        zone.base_rate = payload.base_rate
    if payload.cod_fee_percentage is not None:
        if payload.cod_fee_percentage < 0 or payload.cod_fee_percentage > 100:
            raise HTTPException(status_code=400, detail="COD fee must be between 0 and 100")
        zone.cod_fee_percentage = payload.cod_fee_percentage
    db.commit()
    db.refresh(zone)
    log_service.create_log(
        db, action="zone_pricing_updated", user_id=str(current_user.id),
        entity_type="Zone", entity_id=str(zone.id),
        details=f"base_rate={zone.base_rate}, cod_fee_pct={zone.cod_fee_percentage}",
    )
    db.commit()
    return {"zone_id": str(zone.id), "name": zone.name, "base_rate": zone.base_rate, "cod_fee_percentage": zone.cod_fee_percentage}


@router.post("/pricing/rules", status_code=201)
def create_pricing_rule(
    payload: PricingRuleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    zone = db.query(Zone).filter(Zone.id == payload.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Corridor not found")
    if payload.weight_range_min > payload.weight_range_max:
        raise HTTPException(status_code=400, detail="Min weight cannot exceed max weight")
    rule = PricingRule(
        zone_id=payload.zone_id,
        weight_range_min=payload.weight_range_min,
        weight_range_max=payload.weight_range_max,
        price=payload.price,
        extra_per_kg=payload.extra_per_kg,
        fuel_surcharge_percentage=payload.fuel_surcharge_percentage,
        tax_percentage=payload.tax_percentage,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": str(rule.id), "zone_id": str(rule.zone_id), "weight_range_min": rule.weight_range_min,
            "weight_range_max": rule.weight_range_max, "price": rule.price, "extra_per_kg": rule.extra_per_kg,
            "fuel_surcharge_percentage": rule.fuel_surcharge_percentage, "tax_percentage": rule.tax_percentage}


@router.patch("/pricing/rules/{rule_id}")
def update_pricing_rule(
    rule_id: str,
    payload: PricingRuleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Weight slab not found")
    rule.weight_range_min = payload.weight_range_min
    rule.weight_range_max = payload.weight_range_max
    rule.price = payload.price
    rule.extra_per_kg = payload.extra_per_kg
    rule.fuel_surcharge_percentage = payload.fuel_surcharge_percentage
    rule.tax_percentage = payload.tax_percentage
    db.commit()
    db.refresh(rule)
    return {"id": str(rule.id), "zone_id": str(rule.zone_id), "weight_range_min": rule.weight_range_min,
            "weight_range_max": rule.weight_range_max, "price": rule.price, "extra_per_kg": rule.extra_per_kg,
            "fuel_surcharge_percentage": rule.fuel_surcharge_percentage, "tax_percentage": rule.tax_percentage}


@router.delete("/pricing/rules/{rule_id}", status_code=204)
def delete_pricing_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Weight slab not found")
    db.delete(rule)
    db.commit()


# ---------------------------------------------------------------
# AUDIT LOG - immutable, searchable action trail
# ---------------------------------------------------------------
@router.get("/audit-logs")
def list_audit_logs(
    user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    query = db.query(AuditLog).options(joinedload(AuditLog.user))
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if from_date:
        try:
            f = datetime.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="from_date must be ISO datetime")
        query = query.filter(AuditLog.created_at >= f)
    if to_date:
        try:
            t = datetime.fromisoformat(to_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="to_date must be ISO datetime")
        query = query.filter(AuditLog.created_at <= t)
    if q:
        like = f"%{q}%"
        query = query.filter((AuditLog.action.ilike(like)) | (AuditLog.details.ilike(like)) | (AuditLog.entity_type.ilike(like)))
    rows = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(a.id),
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": str(a.entity_id),
            "details": a.details,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "user": {
                "id": str(a.user.id) if a.user else None,
                "full_name": a.user.full_name if a.user else None,
                "email": a.user.email if a.user else None,
            },
        }
        for a in rows
    ]


# ---------------------------------------------------------------
# SELLER APPROVAL WORKFLOW
# ---------------------------------------------------------------
@router.get("/sellers")
def list_sellers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    businesses = db.query(Business).order_by(Business.created_at.desc()).all()
    order_counts = (
        db.query(Order.seller_business_id, func.count(Order.id))
        .filter(Order.seller_business_id.isnot(None))
        .group_by(Order.seller_business_id)
        .all()
    )
    counts = {str(b): c for b, c in order_counts}
    owners = db.query(User).filter(User.business_id.isnot(None)).all()
    owner_by_business = {str(u.business_id): u for u in owners}
    return [
        {
            "business_id": str(b.id),
            "company_name": b.company_name,
            "business_type": b.business_type,
            "email": b.email,
            "phone": b.phone,
            "city": b.city,
            "status": b.status or "active",
            "is_active": b.is_active,
            "wallet_balance": b.wallet_balance,
            "credit_limit": b.credit_limit,
            "cod_service": b.cod_service,
            "total_orders": counts.get(str(b.id), 0),
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "owner_name": (owner_by_business.get(str(b.id)) or {}).full_name if owner_by_business.get(str(b.id)) else None,
            "owner_verified": (owner_by_business.get(str(b.id)) or {}).is_verified if owner_by_business.get(str(b.id)) else None,
        }
        for b in businesses
    ]


def _set_seller_status(db: Session, business_id: str, status: str, current_user: User, action: str, details: str):
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Seller not found")
    business.status = status
    business.is_active = status == "active"
    db.commit()
    log_service.create_log(
        db, action=action, user_id=str(current_user.id),
        entity_type="Business", entity_id=str(business.id), details=details,
    )
    db.commit()
    db.refresh(business)
    return {"business_id": str(business.id), "company_name": business.company_name, "status": business.status, "is_active": business.is_active}


@router.post("/sellers/{business_id}/approve")
def approve_seller(
    business_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return _set_seller_status(db, business_id, "active", current_user, "seller_approved", "Seller approved by admin")


@router.post("/sellers/{business_id}/reject")
def reject_seller(
    business_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return _set_seller_status(db, business_id, "rejected", current_user, "seller_rejected", "Seller rejected by admin")


@router.post("/sellers/{business_id}/deactivate")
def deactivate_seller(
    business_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return _set_seller_status(db, business_id, "suspended", current_user, "seller_suspended", "Seller deactivated by admin")


@router.post("/sellers/{business_id}/activate")
def activate_seller(
    business_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    return _set_seller_status(db, business_id, "active", current_user, "seller_activated", "Seller reactivated by admin")