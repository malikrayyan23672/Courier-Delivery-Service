from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.permissions import require_roles
from app.models.user import User
from app.models.rnp import RNPPartner, RNPPartnerStatus
from app.schemas.rnp import RNPOut, RNPStatusIn

router = APIRouter(prefix="/admin/rnp", tags=["Admin - RNP Network"])


@router.get("", response_model=list[RNPOut])
def list_rnp(
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    q = db.query(RNPPartner).order_by(RNPPartner.created_at.desc())
    if status_filter:
        q = q.filter(RNPPartner.status == status_filter)
    return [RNPOut.model_validate(p) for p in q.all()]


@router.patch("/{rnp_id}/status", response_model=RNPOut)
def set_rnp_status(
    rnp_id: str,
    payload: RNPStatusIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "super_admin")),
):
    partner = db.query(RNPPartner).filter(RNPPartner.id == rnp_id).first()
    if not partner:
        raise HTTPException(status_code=404, detail="RNP partner not found")

    partner.status = RNPPartnerStatus(payload.status)
    if payload.status == "approved":
        partner.approved_by_id = current_user.id
    db.commit()
    db.refresh(partner)
    return RNPOut.model_validate(partner)