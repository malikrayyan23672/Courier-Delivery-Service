from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.address import Address
from app.models.zone import Zone
from app.models.pricing_rule import PricingRule
from app.models.route import Route

BASE_FARE = 5.0
PER_KM_RATE = 0.8
PER_KG_RATE = 1.5


def estimate_price(pickup: Address, dropoff: Address, weight_kg: float | None, db: Session | None = None) -> float:
    """
    Corridor-aware pricing: base fare from the pickup corridor (zone) +
    distance from the corridor's route leg + the matching weight slab.
    Falls back to the flat heuristic when no pricing data exists (e.g. fresh
    dev databases) so order creation never breaks.
    """
    weight = weight_kg or 1.0
    weight_grams = round(weight * 1000)

    base = BASE_FARE
    per_km = PER_KM_RATE
    slab_price = None

    if db is not None and pickup.city:
        zone = db.query(Zone).filter(func.lower(Zone.name) == func.lower(pickup.city.strip())).first()
        if zone:
            base = zone.base_rate
            rule = (
                db.query(PricingRule)
                .filter(
                    PricingRule.zone_id == zone.id,
                    PricingRule.weight_range_min <= weight_grams,
                    PricingRule.weight_range_max >= weight_grams,
                )
                .order_by(PricingRule.weight_range_min.desc())
                .first()
            )
            if rule:
                slab_price = rule.price
            route = (
                db.query(Route)
                .filter(
                    Route.is_active.is_(True),
                    func.lower(Route.origin) == func.lower(pickup.city.strip()),
                    func.lower(Route.destination) == func.lower(dropoff.city.strip() if dropoff.city else ""),
                )
                .first()
            )
            if route:
                per_km = PER_KM_RATE * (route.distance_km / 5.0) if route.distance_km else per_km

    if slab_price is not None:
        price = base + slab_price + (weight * PER_KG_RATE)
    else:
        distance_km = 5.0  # TODO: replace with real geocoded distance
        price = base + (distance_km * per_km) + (weight * PER_KG_RATE)
    return round(price, 2)