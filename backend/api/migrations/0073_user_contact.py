from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0072_backfillrecord_entries'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='contact',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
