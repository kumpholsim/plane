# Generated manually — auto-convert story points to manhour

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0142_project_is_manhour_enabled_issue_manhour"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="is_manhour_auto_convert_enabled",
            field=models.BooleanField(default=False),
        ),
    ]
