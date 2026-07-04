from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.auth_service import verify_token

# Extracts the token from the "Authorization: Bearer <token>" header
# If the header is missing, returns 403 automatically
security = HTTPBearer()

# Same header extraction, but auto_error=False so a missing/malformed
# Authorization header yields None instead of raising. Used by public
# endpoints that personalise for logged-in users but still work for guests.
security_optional = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    # This is a FastAPI "dependency" — add it to any route that needs auth:
    #   @router.get("/protected")
    #   async def my_route(user_id: str = Depends(get_current_user)):
    #       # user_id is guaranteed valid here
    #
    # FastAPI calls this BEFORE your route runs
    # If the token is bad, the route never executes — user gets 401

    token = credentials.credentials

    user_id = verify_token(token, expected_type="access")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
) -> str | None:
    """Like get_current_user, but returns None instead of raising when the
    Authorization header is missing or the token is invalid/expired.

    Use on public endpoints that enrich their response for authenticated
    users but must still serve anonymous callers.
    """
    if credentials is None:
        return None

    user_id = verify_token(credentials.credentials, expected_type="access")

    # Invalid/expired token on an optional route -> treat as anonymous,
    # don't 401. The route decides what a guest sees.
    return user_id