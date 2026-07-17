import os
import uuid

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def save_pod_photo(order_id: str, photo: UploadFile) -> str:
    """Validate and persist a proof-of-delivery photo for an order.

    Returns the public URL path (served via the /uploads static mount) that
    should be stored on the order. Raises HTTPException on invalid input.
    """
    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Proof of delivery photo must be a JPEG, PNG, or WebP image.",
        )

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    contents = photo.file.read(max_bytes + 1)
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Photo is too large - max {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded photo is empty.")

    ext = ALLOWED_IMAGE_TYPES[photo.content_type]
    folder = os.path.join(settings.UPLOAD_DIR, "pod", str(order_id))
    os.makedirs(folder, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(folder, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    return f"/uploads/pod/{order_id}/{filename}"
