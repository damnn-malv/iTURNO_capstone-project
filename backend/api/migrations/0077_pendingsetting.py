from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0076_pendingfleetaccess'),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('model_label', models.CharField(max_length=60)),
                ('obj_id', models.IntegerField()),
                ('queued_at', models.DateTimeField(auto_now=True)),
            ],
            options={'unique_together': {('model_label', 'obj_id')}},
        ),
    ]
