# Generated manually — allow CSS gradients in issue.badge_color

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0138_issue_badge_color"),
    ]

    operations = [
        migrations.AlterField(
            model_name="issue",
            name="badge_color",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
