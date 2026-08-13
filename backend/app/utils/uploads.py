import os
import uuid

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# Seller portal bulk-order files (Layer 6): CSV / Excel / Word.
ALLOWED_DOC_TYPES = {
    "text/csv": "csv",
    "application/csv": "csv",
    "text/plain": "csv",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

MAX_DOC_SIZE_MB = 25


def save_seller_upload(business_id: str, file: UploadFile) -> tuple[str, str, str]:
    """Persist a seller bulk-order file (CSV/Excel/Doc). Returns (url_path, stored_filename, ext)."""
    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Seller uploads must be CSV, Excel, or Word documents.",
        )

    max_bytes = MAX_DOC_SIZE_MB * 1024 * 1024
    contents = file.file.read(max_bytes + 1)
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File is too large - max {MAX_DOC_SIZE_MB}MB.",
        )
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    ext = ALLOWED_DOC_TYPES[file.content_type]
    folder = os.path.join(settings.UPLOAD_DIR, "seller", str(business_id))
    os.makedirs(folder, exist_ok=True)

    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(folder, stored_filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    return f"/uploads/seller/{business_id}/{stored_filename}", stored_filename, ext


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
