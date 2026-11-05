"""Models for the approved schema (dbqueries/createdb.sql, publics/EER.drawio).

Table and column names match the DDL. Contents is the supertype; each subtype
shares its primary key through Django's multi-table inheritance, so one subtype
object is two rows. Never call save() or delete() on content directly: go
through content.services, which checks the version.
"""
from django.conf import settings
from django.core.validators import URLValidator
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Now


class Content(models.Model):
    """Every piece of editable content, whatever its kind."""

    content_id = models.AutoField(primary_key=True)
    is_published = models.BooleanField(default=False, db_default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_default=Now())
    updated_at = models.DateTimeField(auto_now=True, db_default=Now())
    # Optimistic concurrency token. Only content.services may change it.
    version = models.PositiveIntegerField(default=1, db_default=1, editable=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="content_items",
        db_column="author_id",
    )

    class Meta:
        db_table = "Contents"
        verbose_name = "content"
        permissions = [("publish_content", "Can publish and unpublish content")]

    def __str__(self):
        return f"Content {self.pk}"


def _parent_link(column):
    """The subtype's primary key, which is also its foreign key to Contents."""
    return models.OneToOneField(
        Content,
        on_delete=models.CASCADE,
        parent_link=True,
        primary_key=True,
        db_column=column,
    )


class Announcement(Content):
    content_ptr = _parent_link("announcement_id")
    date = models.DateField()
    title_en = models.CharField("title (English)", max_length=200)
    title_vi = models.CharField("title (Vietnamese)", max_length=200)
    body_en = models.TextField("body (English)")
    body_vi = models.TextField("body (Vietnamese)")

    class Meta:
        db_table = "Announcements"

    def __str__(self):
        return self.title_en


class Rank(models.Model):
    """Lookup, not content. Higher dan_level sorts first."""

    rank_id = models.AutoField(primary_key=True)
    dan_level = models.SmallIntegerField(unique=True)
    rank_en = models.CharField("rank (English)", max_length=50, unique=True)
    rank_vi = models.CharField("rank (Vietnamese)", max_length=50, unique=True)

    class Meta:
        db_table = "Ranks"
        ordering = ["-dan_level"]

    def __str__(self):
        return self.rank_en


class Role(models.Model):
    """Lookup, not content. Lower seniority sorts first: 1 = Head of Dojo."""

    role_id = models.AutoField(primary_key=True)
    seniority = models.SmallIntegerField()
    role_en = models.CharField("role (English)", max_length=100, unique=True)
    role_vi = models.CharField("role (Vietnamese)", max_length=100, unique=True)

    class Meta:
        db_table = "Roles"
        ordering = ["seniority", "role_en"]

    def __str__(self):
        return self.role_en


class Instructor(Content):
    """Everyone on the Instructors page. No role means a black belt listed by
    rank, without a card."""

    content_ptr = _parent_link("instructor_id")
    name = models.CharField(max_length=100)
    rank = models.ForeignKey(Rank, on_delete=models.PROTECT, db_column="rank_id")
    role = models.ForeignKey(Role, on_delete=models.PROTECT, null=True, blank=True, db_column="role_id")
    bio_en = models.TextField("bio (English)", null=True, blank=True)
    bio_vi = models.TextField("bio (Vietnamese)", null=True, blank=True)

    class Meta:
        db_table = "Instructors"

    def __str__(self):
        return self.name


class Faq(Content):
    content_ptr = _parent_link("faq_id")
    question_en = models.CharField("question (English)", max_length=300)
    question_vi = models.CharField("question (Vietnamese)", max_length=300)
    answer_en = models.TextField("answer (English)")
    answer_vi = models.TextField("answer (Vietnamese)")

    class Meta:
        db_table = "FAQs"
        verbose_name = "FAQ"
        verbose_name_plural = "FAQs"

    def __str__(self):
        return self.question_en


class ClassType(models.Model):
    """Lookup, not content: Kids, Teens & Adults, Black Belts."""

    class_type_id = models.AutoField(primary_key=True)
    class_name_en = models.CharField("class name (English)", max_length=100, unique=True)
    class_name_vi = models.CharField("class name (Vietnamese)", max_length=100, unique=True)

    class Meta:
        db_table = "ClassTypes"
        ordering = ["class_name_en"]

    def __str__(self):
        return self.class_name_en


class Schedule(Content):
    """One class slot; a day can have several."""

    class Day(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    content_ptr = _parent_link("schedule_id")
    # In the database this is ON DELETE RESTRICT, so a stray manual DELETE can't
    # wipe a class's slots. CASCADE here is Django's own behavior: it deletes the
    # slots and their Contents rows first, so deleting a class in the admin works.
    class_type = models.ForeignKey(ClassType, on_delete=models.CASCADE, db_column="class_type_id")
    day_of_wk = models.SmallIntegerField("day", choices=Day.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        db_table = "Schedules"
        constraints = [
            models.CheckConstraint(
                condition=Q(day_of_wk__gte=0, day_of_wk__lte=6),
                name="chk_schedule_day",
                violation_error_message="Day must be between Monday and Sunday.",
            ),
            models.CheckConstraint(
                condition=Q(end_time__gt=F("start_time")),
                name="chk_schedule_times",
                violation_error_message="End time must be after start time.",
            ),
            models.UniqueConstraint(
                fields=["day_of_wk", "start_time", "class_type"],
                name="uq_schedule_slot",
                violation_error_message="This class already has a slot at that day and time.",
            ),
        ]

    def __str__(self):
        return f"{self.get_day_of_wk_display()} {self.start_time:%H:%M} {self.class_type}"


class Photo(Content):
    content_ptr = _parent_link("photo_id")
    # Only web links: a javascript: URL here would end up in an <img src>.
    src_link = models.URLField("image URL", max_length=500, validators=[URLValidator(schemes=["http", "https"])])
    alt_en = models.CharField("alt text (English)", max_length=500)
    alt_vi = models.CharField("alt text (Vietnamese)", max_length=500)

    class Meta:
        db_table = "Photos"

    def __str__(self):
        return self.alt_en


class DojoPhoto(models.Model):
    """A photo in the About carousel. Separate from Portrait because one photo
    may be both (the EER's overlapping "o"), which inheritance can't express."""

    photo = models.OneToOneField(
        Photo, on_delete=models.CASCADE, primary_key=True, db_column="photo_id", related_name="dojo_photo",
    )
    sort_order = models.IntegerField(default=0, db_default=0)

    class Meta:
        db_table = "DojoPhotos"
        ordering = ["sort_order", "photo_id"]

    def __str__(self):
        return f"Carousel photo {self.pk}"


class Portrait(models.Model):
    """An instructor's photo. An instructor has at most one."""

    photo = models.OneToOneField(
        Photo, on_delete=models.CASCADE, primary_key=True, db_column="photo_id", related_name="portrait",
    )
    instructor = models.OneToOneField(
        Instructor, on_delete=models.CASCADE, db_column="instructor_id", related_name="portrait",
    )

    class Meta:
        db_table = "Portraits"

    def __str__(self):
        return f"Portrait of {self.instructor}"
