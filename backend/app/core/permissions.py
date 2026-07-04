from fastapi import Depends, HTTPException, status
from app.models.user import User
from app.dependencies import get_current_user


def require_roles(*allowed_roles: str):
    """
    Usage:
        @router.post("/orders", dependencies=[Depends(require_roles("staff", "admin"))])
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of the following roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker
