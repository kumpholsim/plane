# Generated manually — project manhour toggle + L4 issue manhour field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0141_project_event_cover_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="is_manhour_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="issue",
            name="manhour",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
