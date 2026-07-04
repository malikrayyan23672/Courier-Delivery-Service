from app.models.address import Address

BASE_FARE = 5.0
PER_KM_RATE = 0.8
PER_KG_RATE = 1.5


def estimate_price(pickup: Address, dropoff: Address, weight_kg: float | None) -> float:
    """
    Placeholder pricing logic. Replace with real distance calc via
    Google Maps Distance Matrix API / OSRM once geocoding is wired up.
    Never trust client-supplied coordinates or distances for this calc.
    """
    distance_km = 5.0  # TODO: replace with real geocoded distance
    weight = weight_kg or 1.0

    price = BASE_FARE + (distance_km * PER_KM_RATE) + (weight * PER_KG_RATE)
    return round(price, 2)
