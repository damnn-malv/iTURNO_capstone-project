from django.contrib import admin
from .models import User, Driver, Vehicle, Route, Ticket

admin.site.register(User)
admin.site.register(Driver)
admin.site.register(Route)
admin.site.register(Vehicle)
admin.site.register(Ticket)
