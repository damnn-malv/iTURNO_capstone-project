from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0074_alter_user_managers'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='can_manage_fleet',
            field=models.BooleanField(default=False),
        ),
    ]
