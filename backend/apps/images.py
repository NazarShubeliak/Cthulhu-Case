"""Downscaling for uploaded images.

Every player's browser loads each board image, so a 12 MB phone photo costs
the whole table. Uploads are shrunk to MAX_SIDE on their longest edge before
they reach storage; anything Pillow can't safely re-encode passes through.
"""
from io import BytesIO

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.db import models
from PIL import Image, ImageOps
from rest_framework import serializers

MAX_SIDE = 2000
REENCODE_ABOVE_BYTES = 1_500_000
FORMATS = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}


def downscale_image(file, max_side=MAX_SIDE):
    try:
        file.seek(0)
        img = Image.open(file)
        fmt = img.format
        if fmt not in FORMATS or getattr(img, 'is_animated', False):
            return file
        if max(img.size) <= max_side and file.size <= REENCODE_ABOVE_BYTES:
            return file

        img = ImageOps.exif_transpose(img)
        img.thumbnail((max_side, max_side), Image.LANCZOS)
        buf = BytesIO()
        if fmt == 'JPEG':
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            img.save(buf, 'JPEG', quality=85, optimize=True, progressive=True)
        elif fmt == 'PNG':
            img.save(buf, 'PNG', optimize=True)
        else:
            img.save(buf, 'WEBP', quality=85)

        size = buf.tell()
        if size >= file.size:
            return file
        buf.seek(0)
        return InMemoryUploadedFile(
            buf, getattr(file, 'field_name', None), file.name, FORMATS[fmt], size, None,
        )
    except Exception:
        return file
    finally:
        try:
            file.seek(0)
        except Exception:
            pass


class ResizedImageField(serializers.ImageField):
    def to_internal_value(self, data):
        return downscale_image(super().to_internal_value(data))


class ResizedImagesModelSerializer(serializers.ModelSerializer):
    """ModelSerializer whose auto-generated image fields downscale uploads."""
    serializer_field_mapping = {
        **serializers.ModelSerializer.serializer_field_mapping,
        models.ImageField: ResizedImageField,
    }
