from django.db import migrations, models
import django.db.models.deletion


def backfill_owner_driver(apps, schema_editor):
    Vehicle = apps.get_model('api', 'Vehicle')
    Vehicle.objects.update(owner_driver=models.F('active_driver'))


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0057_fix_vehicle_route_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicle',
            name='owner_driver',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='owned_vehicles', to='api.driver'),
        ),
        migrations.RunPython(backfill_owner_driver, noop),
    ]
