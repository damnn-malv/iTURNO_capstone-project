from django.db import migrations, models


def move_global_price_to_jeepney(apps, schema_editor):
    # The old single terminal price was only ever meant for Jeepney; every other
    # type starts at 0 (check disabled) until an admin sets its own price.
    db = schema_editor.connection.alias  # migrate runs per-database; don't read the default DB
    TerminalPrice = apps.get_model('api', 'TerminalPrice')
    PUVType = apps.get_model('api', 'PUVType')
    old = TerminalPrice.objects.using(db).filter(pk=1).first()
    if old and old.amount:
        PUVType.objects.using(db).filter(name='Jeepney').update(terminal_price=old.amount)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0064_ticket_extra_loading_minutes_queue_rank'),
    ]

    operations = [
        migrations.AddField(
            model_name='puvtype',
            name='terminal_price',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.RunPython(move_global_price_to_jeepney, migrations.RunPython.noop),
        migrations.DeleteModel(name='TerminalPrice'),
    ]
