from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_claim_risk_review"),
    ]

    operations = [
        migrations.AddField(
            model_name="claim",
            name="service_date",
            field=models.DateField(null=True, blank=True),
        ),
    ]
