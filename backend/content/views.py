"""Read-only public API for the React site. Response shapes match the files in
frontend/src/data/mock/. Only published content leaves through here."""
from itertools import groupby

from django.http import JsonResponse
from django.views.decorators.http import require_safe

from .models import Announcement, DojoPhoto, Faq, Instructor, Schedule

# Day names are labels, not content, so they aren't in the database.
DAY_NAMES = {
    0: {"en": "Monday", "vi": "Thứ Hai"},
    1: {"en": "Tuesday", "vi": "Thứ Ba"},
    2: {"en": "Wednesday", "vi": "Thứ Tư"},
    3: {"en": "Thursday", "vi": "Thứ Năm"},
    4: {"en": "Friday", "vi": "Thứ Sáu"},
    5: {"en": "Saturday", "vi": "Thứ Bảy"},
    6: {"en": "Sunday", "vi": "Chủ Nhật"},
}


def _translated(obj, field):
    """{ en, vi } from a field's _en / _vi columns. NULL becomes empty text."""
    return {
        "en": getattr(obj, f"{field}_en") or "",
        "vi": getattr(obj, f"{field}_vi") or "",
    }


def _portrait_url(instructor):
    """An unpublished portrait photo must not reach the public site."""
    portrait = getattr(instructor, "portrait", None)
    if portrait is None or not portrait.photo.is_published:
        return None
    return portrait.photo.src_link


@require_safe
def announcements(request):
    items = Announcement.objects.filter(is_published=True).order_by("-date", "-pk")
    return JsonResponse(
        [
            {
                "id": item.pk,
                "date": item.date.isoformat(),
                "title": _translated(item, "title"),
                "body": _translated(item, "body"),
            }
            for item in items
        ],
        safe=False,
    )


@require_safe
def schedule(request):
    slots = (
        Schedule.objects.filter(is_published=True)
        .select_related("class_type")
        .order_by("day_of_wk", "start_time", "class_type__class_name_en")
    )
    return JsonResponse(
        [
            {
                "id": slot.pk,
                "day": DAY_NAMES[slot.day_of_wk],
                "start": slot.start_time.strftime("%H:%M"),
                "end": slot.end_time.strftime("%H:%M"),
                "className": _translated(slot.class_type, "class_name"),
            }
            for slot in slots
        ],
        safe=False,
    )


@require_safe
def instructors(request):
    people = (
        Instructor.objects.filter(is_published=True)
        .select_related("rank", "role", "portrait__photo")
        .order_by("-rank__dan_level", "role__seniority", "name")
    )
    cards = [person for person in people if person.role_id is not None]
    # Rows arrive sorted by rank, so groupby sees each rank once.
    listed = [person for person in people if person.role_id is None]
    return JsonResponse(
        {
            "instructors": [
                {
                    "id": person.pk,
                    "name": person.name,
                    "role": _translated(person.role, "role"),
                    "rank": _translated(person.rank, "rank"),
                    "bio": _translated(person, "bio"),
                    "photo": _portrait_url(person),
                }
                for person in cards
            ],
            "blackBelts": [
                {
                    "rank": _translated(rank, "rank"),
                    "members": [{"id": member.pk, "name": member.name} for member in members],
                }
                for rank, members in groupby(listed, key=lambda person: person.rank)
            ],
        }
    )


@require_safe
def faq(request):
    items = Faq.objects.filter(is_published=True).order_by("pk")
    return JsonResponse(
        [
            {
                "id": item.pk,
                "question": _translated(item, "question"),
                "answer": _translated(item, "answer"),
            }
            for item in items
        ],
        safe=False,
    )


@require_safe
def dojo_photos(request):
    items = DojoPhoto.objects.filter(photo__is_published=True).select_related("photo")
    return JsonResponse(
        [
            {
                "id": item.pk,
                "src": item.photo.src_link,
                "alt": _translated(item.photo, "alt"),
            }
            for item in items
        ],
        safe=False,
    )
