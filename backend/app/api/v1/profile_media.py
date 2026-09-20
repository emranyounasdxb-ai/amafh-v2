"""Authenticated avatar and banner storage with per-target action checks."""

from io import BytesIO
from uuid import UUID

from PIL import Image, UnidentifiedImageError

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select

from app.api.v1.auth import Current, DB
from app.db.models import ProfileMedia, User
from app.security.authorization import require_permission
from app.storage.profile_media import profile_media_storage

router = APIRouter(prefix="/users/{user_id}/profile-images", tags=["profile images"])
KINDS = {"avatar", "banner"}
MIMES = {"image/png", "image/jpeg", "image/webp"}
MAX_BYTES = 1_048_576


def validate(content: bytes, mime: str) -> None:
    if mime not in MIMES:
        raise HTTPException(status_code=422, detail="Choose a PNG, JPEG or WebP image")
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(status_code=422, detail="Image must be non-empty and 1 MB or smaller")
    valid = (mime == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n")
             or mime == "image/jpeg" and content.startswith(b"\xff\xd8\xff")
             or mime == "image/webp" and content.startswith(b"RIFF") and content[8:12] == b"WEBP")
    if not valid:
        raise HTTPException(status_code=422, detail="Image content does not match its type")
    try:
        with Image.open(BytesIO(content)) as image:
            if image.format != {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}[mime]:
                raise ValueError("Image format mismatch")
            if image.width < 1 or image.height < 1 or image.width * image.height > 20_000_000:
                raise ValueError("Image dimensions are invalid")
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=422, detail="Image could not be decoded") from exc


async def target_user(db: DB, user_id: UUID) -> User:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    return target


async def edit_right(db: DB, current: Current, user_id: UUID) -> None:
    await target_user(db, user_id)
    if current.user.id != user_id:
        await require_permission(db, current.user, "Profiles", "edit-other-images")


def kind_check(kind: str) -> None:
    if kind not in KINDS:
        raise HTTPException(status_code=404, detail="Image kind not found")


@router.get("")
async def list_images(user_id: UUID, current: Current, db: DB) -> dict[str, str]:
    await target_user(db, user_id)
    records = (await db.scalars(select(ProfileMedia).where(ProfileMedia.user_id == user_id))).all()
    return {item.kind: f"/api/v1/users/{user_id}/profile-images/{item.kind}" for item in records}


@router.get("/{kind}")
async def image(user_id: UUID, kind: str, current: Current, db: DB) -> Response:
    kind_check(kind)
    await target_user(db, user_id)
    item = (await db.scalars(select(ProfileMedia).where(ProfileMedia.user_id == user_id, ProfileMedia.kind == kind))).one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        content = profile_media_storage().get(item.storage_key)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Image storage is unavailable") from exc
    return Response(content, media_type=item.mime_type, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.put("/{kind}")
async def save_image(user_id: UUID, kind: str, request: Request, current: Current, db: DB) -> dict[str, str]:
    kind_check(kind)
    await edit_right(db, current, user_id)
    mime = request.headers.get("content-type", "").split(";")[0].lower()
    content = await request.body()
    validate(content, mime)
    item = (await db.scalars(select(ProfileMedia).where(ProfileMedia.user_id == user_id, ProfileMedia.kind == kind).with_for_update())).one_or_none()
    store = profile_media_storage()
    key = store.put(content)
    old_key = item.storage_key if item else None
    if item:
        item.storage_key = key
        item.mime_type = mime
        item.byte_size = len(content)
        item.uploaded_by_id = current.user.id
    else:
        db.add(ProfileMedia(user_id=user_id, kind=kind, storage_key=key, mime_type=mime, byte_size=len(content), uploaded_by_id=current.user.id))
    try:
        await db.commit()
    except Exception:
        store.delete(key)
        raise
    if old_key:
        store.delete(old_key)
    return {"url": f"/api/v1/users/{user_id}/profile-images/{kind}"}


@router.delete("/{kind}", status_code=204)
async def remove_image(user_id: UUID, kind: str, current: Current, db: DB) -> Response:
    kind_check(kind)
    await edit_right(db, current, user_id)
    item = (await db.scalars(select(ProfileMedia).where(ProfileMedia.user_id == user_id, ProfileMedia.kind == kind).with_for_update())).one_or_none()
    if item:
        key = item.storage_key
        await db.delete(item)
        await db.commit()
        profile_media_storage().delete(key)
    return Response(status_code=204)
