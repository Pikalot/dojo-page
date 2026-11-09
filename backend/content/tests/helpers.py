import datetime

from django.contrib.auth import get_user_model

from content.models import Announcement, ClassType, Faq, Photo, Rank, Role, Schedule

User = get_user_model()


def make_author(username="author"):
    return User.objects.create_user(username=username, password="pw-for-tests")


def make_announcement(author, title="Original", is_published=True, date=datetime.date(2026, 1, 1)):
    return Announcement.objects.create(
        author=author,
        is_published=is_published,
        date=date,
        title_en=title,
        title_vi=f"{title} vi",
        body_en="Body",
        body_vi="Nội dung",
    )


def make_faq(author, question="Question?", is_published=True):
    return Faq.objects.create(
        author=author,
        is_published=is_published,
        question_en=question,
        question_vi=f"{question} vi",
        answer_en="Answer",
        answer_vi="Trả lời",
    )


def make_class_type(name="Kids"):
    return ClassType.objects.create(class_name_en=name, class_name_vi=f"{name} vi")


def make_schedule(author, class_type, day=0, start="19:00", end="20:30", is_published=True):
    return Schedule.objects.create(
        author=author,
        is_published=is_published,
        class_type=class_type,
        day_of_wk=day,
        start_time=datetime.time.fromisoformat(start),
        end_time=datetime.time.fromisoformat(end),
    )


def make_rank(level=1, name="Shodan"):
    return Rank.objects.create(dan_level=level, rank_en=name, rank_vi=f"{name} vi")


def make_role(seniority=1, name="Head of Dojo"):
    return Role.objects.create(seniority=seniority, role_en=name, role_vi=f"{name} vi")


def make_photo(author, alt="A photo", is_published=True):
    return Photo.objects.create(
        author=author,
        is_published=is_published,
        src_link=f"https://example.invalid/{alt.replace(' ', '-')}.jpg",
        alt_en=alt,
        alt_vi=f"{alt} vi",
    )
