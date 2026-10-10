from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0065_puvtype_terminal_price_delete_terminalprice'),
    ]

    operations = [
        migrations.AddField(
            model_name='driver',
            name='iwp_expiration_date',
            field=models.DateField(blank=True, null=True),
        ),
    ]
