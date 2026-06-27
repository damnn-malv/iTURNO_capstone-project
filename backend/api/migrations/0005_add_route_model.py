from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_alter_ticket_status'),
    ]

    operations = [
        # 1. Create the Route table
        migrations.CreateModel(
            name='Route',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('origin', models.CharField(db_index=True, max_length=100, unique=True)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['origin'],
            },
        ),

        # 2. Add a nullable route FK to Vehicle (alongside existing route CharField)
        migrations.AddField(
            model_name='vehicle',
            name='route_fk',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='vehicles',
                to='api.route',
                db_column='route_fk_id',
            ),
        ),

        # 3. Remove the old route CharField from Vehicle
        migrations.RemoveField(
            model_name='vehicle',
            name='route',
        ),

        # 4. Rename route_fk → route
        migrations.RenameField(
            model_name='vehicle',
            old_name='route_fk',
            new_name='route',
        ),
    ]
