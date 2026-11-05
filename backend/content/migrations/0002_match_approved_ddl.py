"""Applies what dbqueries/createdb.sql specifies but Django models can't express.

Django manages foreign keys with no ON DELETE clause and does its cascading in
Python. These rules protect the data from manual SQL too. If a later migration
alters one of these columns, Django recreates the key without them, so re-run
this step for that key.
"""
from django.db import migrations

# (table, column, referenced table, referenced column, ON DELETE, ON UPDATE)
FOREIGN_KEYS = [
    ("Announcements", "announcement_id", "Contents", "content_id", "CASCADE", "CASCADE"),
    ("Instructors", "instructor_id", "Contents", "content_id", "CASCADE", "CASCADE"),
    ("Instructors", "rank_id", "Ranks", "rank_id", "RESTRICT", "CASCADE"),
    ("Instructors", "role_id", "Roles", "role_id", "RESTRICT", "CASCADE"),
    ("FAQs", "faq_id", "Contents", "content_id", "CASCADE", "CASCADE"),
    ("Schedules", "schedule_id", "Contents", "content_id", "CASCADE", "CASCADE"),
    ("Schedules", "class_type_id", "ClassTypes", "class_type_id", "RESTRICT", "CASCADE"),
    ("Photos", "photo_id", "Contents", "content_id", "CASCADE", "CASCADE"),
    ("DojoPhotos", "photo_id", "Photos", "photo_id", "CASCADE", "CASCADE"),
    ("Portraits", "photo_id", "Photos", "photo_id", "CASCADE", "CASCADE"),
    ("Portraits", "instructor_id", "Instructors", "instructor_id", "CASCADE", "CASCADE"),
    ("Contents", "author_id", "auth_user", "id", "RESTRICT", "CASCADE"),
]


def _constraint_name(cursor, table, column):
    cursor.execute(
        """
        SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s
          AND REFERENCED_TABLE_NAME IS NOT NULL
        """,
        [table, column],
    )
    return cursor.fetchone()[0]


def _rebuild_keys(schema_editor, with_rules):
    with schema_editor.connection.cursor() as cursor:
        for table, column, ref_table, ref_column, on_delete, on_update in FOREIGN_KEYS:
            name = _constraint_name(cursor, table, column)
            rules = f" ON DELETE {on_delete} ON UPDATE {on_update}" if with_rules else ""
            cursor.execute(f"ALTER TABLE `{table}` DROP FOREIGN KEY `{name}`")
            cursor.execute(
                f"ALTER TABLE `{table}` ADD CONSTRAINT `{name}` FOREIGN KEY (`{column}`) "
                f"REFERENCES `{ref_table}` (`{ref_column}`){rules}"
            )


def apply_rules(apps, schema_editor):
    _rebuild_keys(schema_editor, with_rules=True)


def remove_rules(apps, schema_editor):
    _rebuild_keys(schema_editor, with_rules=False)


class Migration(migrations.Migration):
    dependencies = [("content", "0001_initial")]

    operations = [
        migrations.RunPython(apply_rules, remove_rules),
        migrations.RunSQL(
            "ALTER TABLE Contents MODIFY updated_at datetime(6) NOT NULL "
            "DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)",
            "ALTER TABLE Contents MODIFY updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)",
        ),
    ]
