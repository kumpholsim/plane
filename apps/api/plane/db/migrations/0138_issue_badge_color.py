# Generated manually for Scrumban epic badge colors

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0137_project_average_velocity_cycle_capacity_holidays"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="badge_color",
            field=models.CharField(blank=True, max_length=16, null=True),
        ),
    ]
