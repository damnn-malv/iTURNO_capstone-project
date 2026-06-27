import csv
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone
from datetime import datetime, timedelta, timezone as dt_timezone

import json, os
from django.conf import settings

from .models import User, Driver, Vehicle, Route, Ticket, TicketPrice, PUVType, Route, RemittanceBatch, Collection, Deposit, TicketForm, Denomination, Requisition, TicketSeries
from .serializers import UserSerializer, DriverSerializer, VehicleSerializer, RouteSerializer, TicketSerializer, TicketPriceSerializer, PUVTypeSerializer, RouteSerializer, RemittanceBatchSerializer, TicketFormSerializer, DenominationSerializer, RequisitionSerializer, TicketSeriesSerializer
from rest_framework.views import APIView

#viewsets
class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer


class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.all()
    serializer_class = RouteSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer


class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

    def perform_create(self, serializer):
        if self.request.user and self.request.user.is_authenticated:
            serializer.save(active_user=self.request.user)
        else:
            serializer.save()

class TicketPriceViewSet(viewsets.ModelViewSet):
    queryset = TicketPrice.objects.all()
    serializer_class = TicketPriceSerializer

class PUVTypeViewSet(viewsets.ModelViewSet):
    queryset = PUVType.objects.all()
    serializer_class = PUVTypeSerializer

class TicketFormViewSet(viewsets.ModelViewSet):
    queryset = TicketForm.objects.all()
    serializer_class = TicketFormSerializer

class DenominationViewSet(viewsets.ModelViewSet):
    queryset = Denomination.objects.all()
    serializer_class = DenominationSerializer

class RequisitionViewSet(viewsets.ModelViewSet):
    queryset = Requisition.objects.all()
    serializer_class = RequisitionSerializer

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

class TicketSeriesViewSet(viewsets.ModelViewSet):
    queryset = TicketSeries.objects.all()
    serializer_class = TicketSeriesSerializer

class RemittanceBatchViewSet(viewsets.ModelViewSet):
    queryset = RemittanceBatch.objects.all()
    serializer_class = RemittanceBatchSerializer

#batch
def load_schedule():
    schedule_path = os.path.join(settings.BASE_DIR, "schedules.json")
    with open(schedule_path, "r") as f:
        return json.load(f)

def get_batch(ticket):
    local_hour = (ticket.issued_at + timedelta(hours=8)).hour
    schedule = load_schedule()
    for key, shift in schedule.items():
        if shift["startHour"] <= local_hour < shift["endHour"]:
            return key
    return None


def parse_date_start(date_str):
    # Returns UTC-aware datetime for start of day (PH time = UTC+8)
    d = datetime.strptime(date_str, '%Y-%m-%d')
    ph_start = datetime(d.year, d.month, d.day, 0, 0, 0)
    return timezone.make_aware(ph_start - timedelta(hours=8))


def parse_date_end(date_str):
    # Returns UTC-aware datetime for end of day (PH time = UTC+8)
    d = datetime.strptime(date_str, '%Y-%m-%d')
    ph_end = datetime(d.year, d.month, d.day, 23, 59, 59)
    return timezone.make_aware(ph_end - timedelta(hours=8))


def get_batch_code(batch_name):
    schedule = load_schedule()
    # Map batch names to codes dynamically
    codes = {name.replace("_", " ").title(): str(shift["startHour"]).zfill(2) for name, shift in schedule.items()}
    return codes.get(batch_name, "00")


def parse_iso_datetime(value):
    if not value:
        return timezone.now()
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        dt = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%fZ')
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, dt_timezone.utc)
    return dt.astimezone(dt_timezone.utc)


def generate_ticket_id(issued_at, batch_name):
    local_dt = issued_at + timedelta(hours=8)
    date_code = local_dt.strftime('%Y%m%d')
    prefix = f'TICKET-{date_code}{get_batch_code(batch_name)}'
    last_ticket = Ticket.objects.filter(id__startswith=prefix).order_by('-id').first()
    if last_ticket:
        last_seq = int(last_ticket.id[-4:]) if last_ticket.id[-4:].isdigit() else 0
        next_seq = str(last_seq + 1).zfill(4)
    else:
        next_seq = '0001'
    return f'{prefix}{next_seq}'

def filter_collected(start_date=None, end_date=None):
    qs = Ticket.objects.filter(status='COLLECTED')
    if start_date:
        try:
            qs = qs.filter(issued_at__gte=parse_date_start(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            qs = qs.filter(issued_at__lte=parse_date_end(end_date))
        except ValueError:
            pass
    return qs


def summarize(ticket_list, fallback_amount=0.0):
    count = len(ticket_list)
    total = round(sum(
        float(t.collection_amount) if (t.collection_amount is not None and float(t.collection_amount) > 0) else fallback_amount
        for t in ticket_list
    ), 2)
    return {'count': count, 'total': total}

@api_view(['POST'])
def issue_late_ticket(request):
    try:
        data = request.data
        
        # Validate required fields
        required_fields = ['vehicle', 'driver', 'route', 'intended_batch']
        for field in required_fields:
            if not data.get(field):
                return Response(
                    {"error": f"Missing required field: {field}"},
                    status=400
                )
        
        # Validate route is not empty or "N/A"
        if not data.get('route') or data.get('route') == 'N/A':
            return Response(
                {"error": "Route cannot be empty or 'N/A'. Please select a valid vehicle with a route."},
                status=400
            )

        issued_at = parse_iso_datetime(data.get('issued_at'))
        ticket_id = generate_ticket_id(issued_at, data['intended_batch'])
        
        route_value = data.get('route')
        route_obj = None
        if route_value:
            if isinstance(route_value, int) or (isinstance(route_value, str) and route_value.isdigit()):
                route_obj = Route.objects.filter(id=int(route_value)).first()
            elif hasattr(route_value, 'pk'):
                route_obj = route_value
            else:
                route_obj = Route.objects.filter(origin=route_value).first()

        if not route_obj:
            return Response(
                {"error": "Route cannot be found. Please select a valid route."},
                status=400
            )

        ticket = Ticket.objects.create(
            id=ticket_id,
            vehicle_id=data['vehicle'],
            driver_id=data['driver'],
            route=route_obj,
            status='ISSUED',
            is_late=True,
            intended_batch=data['intended_batch'],
            issued_at=issued_at,
            active_user=request.user if request.user.is_authenticated else None,
        )
        
        serializer = TicketSerializer(ticket)
        return Response({
            "message": "Late ticket issued successfully",
            "ticket": serializer.data
        }, status=201)
        
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=400
        )


@api_view(['GET'])
def report_summary(request):
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    tickets = list(filter_collected(start_date, end_date))

    now_ph = timezone.now() + timedelta(hours=8)
    today_utc_start = timezone.make_aware(
        datetime(now_ph.year, now_ph.month, now_ph.day, 0, 0, 0) - timedelta(hours=8)
    )
    today_utc_end = timezone.make_aware(
        datetime(now_ph.year, now_ph.month, now_ph.day, 23, 59, 59) - timedelta(hours=8)
    )

    # Fallback price for tickets with null/zero collection_amount
    latest_price = TicketPrice.objects.order_by('-effective_date').first()
    fallback_amount = float(latest_price.amount) if latest_price else 0.0

    schedule = load_schedule()
    batch_stats = {}
    for key in schedule.keys():
        normalized = key.lower().replace("_", "")  # "BATCH_1" → "batch1"
        batch_tickets = [t for t in tickets if get_batch(t) == key]
        batch_stats[normalized] = summarize(batch_tickets, fallback_amount)

    today = [t for t in tickets if today_utc_start <= t.issued_at <= today_utc_end]

    return Response({
        **batch_stats,
        'today': summarize(today, fallback_amount),
        'grand_total': round(sum(
            float(t.collection_amount) if (t.collection_amount and float(t.collection_amount) > 0) else fallback_amount
            for t in tickets
        ), 2),
        'total_tickets': len(tickets),
    })





@api_view(['GET'])
def report_collections(request):
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    tickets = filter_collected(start_date, end_date).select_related('vehicle', 'driver', 'active_user').order_by('-issued_at')

    data = []
    for t in tickets:
        local_dt = t.issued_at + timedelta(hours=8)
        data.append({
            'id': t.id,
            'batch': get_batch(t),
            'issued_at': local_dt.strftime('%Y-%m-%d %H:%M'),
            'issued_date': local_dt.strftime('%Y-%m-%d'),
            'driver': str(t.driver) if t.driver else '',
            'vehicle': t.vehicle.plate_number if t.vehicle else '',
            'route': t.route_name,
            'collection_amount': float(t.collection_amount or 0),
            'status': t.status,
        })

    return Response({'results': data, 'count': len(data)})


@api_view(['GET'])
def report_daily_chart(request):
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    tickets = filter_collected(start_date, end_date)
    schedule = load_schedule()

    # Fallback price: used when a ticket's collection_amount is null or zero
    latest_price = TicketPrice.objects.order_by('-effective_date').first()
    fallback_amount = float(latest_price.amount) if latest_price else 0.0

    daily = {}
    for t in tickets:
        local_dt = t.issued_at + timedelta(hours=8)
        day_key = local_dt.strftime('%Y-%m-%d')
        batch = get_batch(t)  # returns "BATCH_1", "BATCH_2", etc.

        # compute amount with fallback
        amount = float(t.collection_amount) if (t.collection_amount and float(t.collection_amount) > 0) else fallback_amount

        if day_key not in daily:
            daily[day_key] = {'date': day_key}
            # initialize dynamic batch keys
            for key in schedule.keys():
                normalized = key.lower().replace("_", "")  # "BATCH_1" → "batch1"
                daily[day_key][f"{normalized}_count"] = 0
                daily[day_key][f"{normalized}_total"] = 0.0

        if batch:
            normalized = batch.lower().replace("_", "")
            daily[day_key][f"{normalized}_count"] += 1
            daily[day_key][f"{normalized}_total"] = round(daily[day_key][f"{normalized}_total"] + amount, 2)

    return Response({'chart_data': sorted(daily.values(), key=lambda x: x['date'])})


@api_view(['GET'])
def transaction_logs(request):
    show_all = request.query_params.get('all', 'false').lower() == 'true'

    tickets = Ticket.objects.select_related('vehicle', 'driver', 'active_user').order_by('-created_at')

    data = []
    for t in tickets:
        local_dt = t.created_at + timedelta(hours=8)
        data.append({
            'id': t.id,
            'action': t.status,
            'ticket_id': t.id,
            'driver': str(t.driver) if t.driver else '',
            'vehicle': t.vehicle.plate_number if t.vehicle else '',
            'route': t.route_name,
            'amount': float(t.collection_amount or 0),
            'timestamp': local_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'user': t.active_user.username if t.active_user else 'System',
            'batch': get_batch(t),
        })

    total = len(data)
    if not show_all:
        data = data[:10]

    return Response({'logs': data, 'total': total})


@api_view(['GET'])
def dashboard_stats(request):
    now_ph = timezone.now() + timedelta(hours=8)
    today_start = timezone.make_aware(
        datetime(now_ph.year, now_ph.month, now_ph.day, 0, 0, 0) - timedelta(hours=8)
    )

    today_dispatched = Ticket.objects.filter(
        dispatched_at__isnull=False,
        dispatched_at__gte=today_start
    )

    # Fallback price for tickets with null collection_amount
    latest_price = TicketPrice.objects.order_by('-effective_date').first()
    fallback_amount = float(latest_price.amount) if latest_price else 0.0

    # Dynamic batches from schedule.json
    schedule = load_schedule()
    batch_stats = {}
    for key in schedule.keys():
        batch_tickets = [t for t in today_dispatched if get_batch(t) == key]
        normalized = key.lower().replace("_", "")
        batch_stats[f"{normalized}_today"] = summarize(batch_tickets, fallback_amount)

    return Response({
        **batch_stats,
        'today_total': summarize(today_dispatched, fallback_amount),
        'total_tickets': Ticket.objects.count(),
        'total_dispatched': Ticket.objects.filter(dispatched_at__isnull=False).count(),
        'total_revenue': round(float(today_dispatched.aggregate(s=Sum('collection_amount'))['s'] or 0), 2),
        'active_vehicles': Vehicle.objects.filter(is_archived=False).count(),
        'active_drivers': Driver.objects.filter(is_archived=False).count(),
    })





@api_view(['GET'])
def vehicle_records(request):
    """Fetch vehicle records with relational data: code, plate, route, and driver"""
    try:
        vehicles = Vehicle.objects.select_related('route', 'active_driver').order_by('code')
        print(f"DEBUG: Found {vehicles.count()} vehicles")
        
        data = []
        for v in vehicles:
            try:
                record = {
                    'id': v.id,
                    'code': v.code,
                    'plate_number': v.plate_number,
                    'route': v.route.full_name if v.route else '—',
                    'driver': v.active_driver.name if v.active_driver else '—',
                    'status': v.get_status_display() if hasattr(v, 'get_status_display') else v.status,
                }
                data.append(record)
                print(f"DEBUG: Added vehicle {record}")
            except Exception as e:
                print(f"DEBUG: Error processing vehicle {v.id}: {e}")
                continue

        print(f"DEBUG: Returning {len(data)} vehicles")
        return Response({'vehicles': data, 'total': len(data)})
    except Exception as e:
        print(f"DEBUG: Error in vehicle_records: {e}")
        return Response({'error': str(e), 'vehicles': [], 'total': 0}, status=500)


@api_view(['GET'])
def driver_records(request):
    """Fetch driver records with relational data: code, name, and contact number"""
    try:
        drivers = Driver.objects.order_by('code')
        print(f"DEBUG: Found {drivers.count()} drivers")

        data = []
        for d in drivers:
            try:
                record = {
                    'id': d.id,
                    'code': d.code,
                    'name': d.name,
                    'contact_number': d.contact_number if d.contact_number else '—',
                }
                data.append(record)
                print(f"DEBUG: Added driver {record}")
            except Exception as e:
                print(f"DEBUG: Error processing driver {d.id}: {e}")
                continue

        print(f"DEBUG: Returning {len(data)} drivers")
        return Response({'drivers': data, 'total': len(data)})
    except Exception as e:
        print(f"DEBUG: Error in driver_records: {e}")
        return Response({'error': str(e), 'drivers': [], 'total': 0}, status=500)


@api_view(['GET'])
def public_queue(request):
    # Get vehicles that have tickets with status 'ISSUED'
    vehicles_with_issued_tickets = Vehicle.objects.filter(
        tickets__status='ISSUED',
        is_archived=False
    ).distinct().select_related('route', 'active_driver')

    data = []
    for vehicle in vehicles_with_issued_tickets:
        # Get the latest issued ticket for departure time
        latest_ticket = vehicle.tickets.filter(status='ISSUED').order_by('-issued_at').first()
        departure_time = None
        if latest_ticket:
            # Convert to local time (PH time = UTC+8)
            local_dt = latest_ticket.issued_at + timedelta(hours=8)
            departure_time = local_dt.strftime('%I:%M %p')

        data.append({
            'id': vehicle.id,
            'plate_number': vehicle.plate_number,
            'driver': vehicle.active_driver.name if vehicle.active_driver else '',
            'route': vehicle.route.full_name if vehicle.route else '',
            'status': vehicle.get_status_display(),
            'departure_time': departure_time,
        })

    return Response(data)

# if nag loloko date sa current device, no need another call kung gumagana maayos date
@api_view(['GET'])
def server_time(request):
    """Return current server time in ISO format"""
    now = timezone.now()
    return Response({'time': now.isoformat()})


@api_view(['GET', 'PUT'])
def schedules_view(request):
    import json
    import os
    file_path = os.path.join(os.path.dirname(__file__), '..', 'schedules.json')
    if request.method == 'GET':
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            return Response(data)
        except FileNotFoundError:
            return Response({'error': 'Schedules file not found'}, status=404)
        except json.JSONDecodeError:
            return Response({'error': 'Invalid JSON'}, status=500)
    elif request.method == 'PUT':
        try:
            data = request.data
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
            return Response({'status': 'updated'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
        
@api_view(['GET'])
def export_collections_csv(request):
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    tickets = filter_collected(start_date, end_date).select_related(
        'vehicle', 'driver', 'active_user'
    ).order_by('-issued_at')

    # Prepare HTTP response with CSV headers
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="collections_report.csv"'

    writer = csv.writer(response)
    # Header row
    writer.writerow([
        "Ticket ID", "Batch", "Issued Date", "Issued Time",
        "Driver", "Vehicle", "Route", "Collection Amount",
        "Status", "User"
    ])

    # Data rows
    for t in tickets:
        local_dt = t.issued_at + timedelta(hours=8)
        writer.writerow([
            t.id,
            get_batch(t),
            local_dt.strftime('%Y-%m-%d'),
            local_dt.strftime('%H:%M'),
            str(t.driver) if t.driver else "",
            t.vehicle.plate_number if t.vehicle else "",
            t.route_name,
            float(t.collection_amount or 0),
            t.status,
            t.active_user.username if t.active_user else "System",
        ])

    return response

@api_view(['GET', 'POST'])
def remittance_batches(request):
    if request.method == 'POST':
        data = request.data
        batch = RemittanceBatch.objects.create(
            issued_by=request.user if request.user.is_authenticated else None,
            total_amount=data.get('total_amount', 0),
            status=data.get('status', 'OPEN'),
        )
        for c in data.get('collections', []):
            Collection.objects.create(
                batch=batch,
                ticket_form_no=c.get('ticketFormNo', ''),
                from_no=str(c.get('from', '')),
                to_no=str(c.get('to', '')),
                amount=c.get('amount', 0),
            )
        for d in data.get('deposits', []):
            Deposit.objects.create(
                batch=batch,
                type=d.get('type', 'bill'),
                denomination=d.get('denomination', 0),
                quantity=d.get('quantity', 0),
                deposit_amount=d.get('depositAmount', 0),
            )
        return Response({'id': batch.id, 'status': 'created'}, status=201)

    batches = RemittanceBatch.objects.select_related('issued_by').order_by('-issued_at')
    serializer = RemittanceBatchSerializer(batches, many=True)
    return Response({
        'results': serializer.data,
        'count': batches.count()
    })
