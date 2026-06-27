from django.core.management.base import BaseCommand
from api.models import Vehicle


class Command(BaseCommand):
    help = 'Verify and regenerate vehicle codes if missing'

    def handle(self, *args, **options):
        vehicles = Vehicle.objects.all()
        self.stdout.write(f"Total vehicles in database: {vehicles.count()}")
        
        for v in vehicles:
            self.stdout.write(f"Vehicle ID: {v.id}, Code: {v.code}, Plate: {v.plate_number}, Route: {v.route}, Driver: {v.active_driver}")
            
            # Regenerate code if missing
            if not v.code:
                v.code = f"VHC{str(v.id).zfill(3)}"
                v.save(update_fields=['code'])
                self.stdout.write(self.style.SUCCESS(f"✓ Generated code for vehicle {v.id}: {v.code}"))
        
        self.stdout.write(self.style.SUCCESS("✓ Verification complete"))
