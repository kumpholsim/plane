# Generated manually — project event cover image

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0140_project_event"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectevent",
            name="cover_image",
            field=models.TextField(blank=True, default=None, null=True),
        ),
    ]
