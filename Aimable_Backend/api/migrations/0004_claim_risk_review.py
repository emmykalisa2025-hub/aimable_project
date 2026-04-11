from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_systemlog"),
    ]

    operations = [
        migrations.AddField(
            model_name="claim",
            name="risk_score",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name="claim",
            name="review_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("investigation", "Under investigation"),
                    ("fraudulent", "Fraudulent"),
                    ("legitimate", "Legitimate"),
                ],
                default="pending",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="claim",
            name="notes",
            field=models.TextField(blank=True),
        ),
    ]
