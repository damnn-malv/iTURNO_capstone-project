import csv
import io
from datetime import datetime, timedelta

from django.core.files.base import ContentFile
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..models import Ticket, Vehicle, TicketForm, TicketSeries, User, WipMode, BackfillRecord
from ..serializers import WipModeSerializer, BackfillRecordSerializer
from .helpers import record_audit_log, paginate_request
from .viewsets import IsSupervisorOrAdminForWrite, _consume_series_fifo

# Column/field names, shared by the CSV header row and the manual-entry JSON
# payload (both funnel through _resolve_batch below). Plain-English on purpose —
# the person filling these out is terminal staff working from a paper ticket
# during an outage, not a developer, so the names match what they'd recognize
# from elsewhere in the app rather than internal field names like plate_number.
#
# There's no Driver or Route column anymore — both are always taken from the
# vehicle itself (Vehicle.owner_driver / Vehicle.route), never typed in. There's
# no Amount column either — price is always the Ticket Type's price. Ticket
# Number is only used by Single Entry's "I have the exact ticket number"
# fallback (see _resolve_batch) — CSV never carries it.
F_TICKET_ID = 'Ticket Number'
F_PLATE = 'Vehicle Plate Number'
F_TICKET_TYPE = 'Ticket Type'
F_QUANTITY = 'Ticket Amount'
F_ISSUED_AT = 'Date and Time Issued'
F_STAFF_EMAIL = 'Staff Email'
F_MODE = 'Mode'
F_NOTES = 'Notes'

# CSV header requirements. Notes/Import Reason is supplied once for the whole
# file (see backfill_preview/backfill_import), not as a column — but Date and
# Time Issued stays per row: the paper log books this data comes from are kept
# per-route with their own real timestamps, so one shared value for the whole
# file would be less accurate than what's already on each row.
REQUIRED_CSV_COLUMNS = [F_PLATE, F_TICKET_TYPE, F_QUANTITY, F_ISSUED_AT]

# "Queue"/"Roaming" match the labels already used on the Queue Management page
# (queue.jsx); QUEUE/UNLOAD are the raw values Ticket.mode actually stores —
# both are accepted so a technical CSV built from other tooling still works.
MODE_ALIASES = {'QUEUE': 'QUEUE', 'ROAMING': 'UNLOAD', 'UNLOAD': 'UNLOAD'}


@api_view(['GET', 'PUT'])
@permission_classes([IsSupervisorOrAdminForWrite])
def wip_mode_config(request):
    config = WipMode.get_solo()
    if request.method == 'GET':
        return Response(WipModeSerializer(config).data)

    serializer = WipModeSerializer(config, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    record_audit_log(
        user=request.user, action='UPDATE', model_name='WipMode',
        object_id=config.pk, object_repr='WIP mode configuration',
        changes=request.data,
    )
    return Response(serializer.data)


def _parse_ph_datetime(value):
    # Same "PH-local in, UTC-aware out" idiom as helpers.parse_date_start/_end.
    dt = datetime.strptime(value.strip(), '%Y-%m-%d %H:%M')
    return timezone.make_aware(dt - timedelta(hours=8))


def _find_series_for_ticket_id(ticket_id):
    """A backfilled ticket number must be a real physical ticket from a requisitioned
    booklet, not an arbitrary string — find the TicketSeries whose printed start_no..end_no
    range covers it (archived requisitions count too: an old, fully-issued booklet is still
    a real one — this is the one path that can still reach an archived booklet, since
    _consume_series_fifo below deliberately excludes them). Returns None if no series
    covers it, or the id isn't a plain integer."""
    try:
        n = int(ticket_id)
    except (TypeError, ValueError):
        return None
    for series in TicketSeries.objects.all():
        try:
            if int(series.start_no) <= n <= int(series.end_no):
                return series
        except (TypeError, ValueError):
            continue
    return None


def _resolve_batch(row):
    """Validate + resolve one backfill entry. Returns (resolved_dict_or_None, outcome, reason)
    where outcome is 'ok' | 'duplicate' | 'error'. Never writes anything, never reserves
    ticket numbers — shared by the CSV loop and the manual-entry endpoint, and both
    endpoints' dry-run path.

    resolved['units'] is None for the normal path (the caller must reserve numbers via
    _consume_series_fifo inside a transaction at commit time — that's deferred rather than
    done here so preview/dry-run never locks or claims stock). It's a ready-made
    [(series, ticket_id)] list of length 1 only for the exact-ticket-number fallback,
    since that number is already known and validated up front.
    """
    get = lambda k: (row.get(k) or '').strip()

    plate = get(F_PLATE)
    vehicle = Vehicle.objects.filter(plate_number__iexact=plate).first()
    if not vehicle:
        return None, 'error', f"Vehicle not found: {F_PLATE}='{plate}'"
    driver = vehicle.owner_driver
    if not driver:
        return None, 'error', (
            f"Vehicle '{vehicle.plate_number}' has no registered owner — "
            "set one on the Fleet & Driver page first."
        )
    route = vehicle.route

    ticket_type = get(F_TICKET_TYPE)
    if not ticket_type:
        return None, 'error', f'{F_TICKET_TYPE} is required'
    form = TicketForm.objects.filter(name__iexact=ticket_type).first()
    if not form:
        return None, 'error', f"{F_TICKET_TYPE} not found: '{ticket_type}'"

    exact_ticket_id = get(F_TICKET_ID)
    units = None
    quantity = 1
    if exact_ticket_id:
        if Ticket.objects.filter(id=exact_ticket_id).exists():
            return None, 'duplicate', 'This ticket number already exists'
        series = _find_series_for_ticket_id(exact_ticket_id)
        if series is None:
            return None, 'error', (
                f"{F_TICKET_ID} '{exact_ticket_id}' doesn't fall within any requisitioned "
                "ticket series — check the number on the paper ticket."
            )
        units = [(series, exact_ticket_id)]
    else:
        qty_raw = get(F_QUANTITY)
        try:
            quantity = int(qty_raw)
        except ValueError:
            return None, 'error', f"Invalid {F_QUANTITY}: '{qty_raw}'"
        if quantity < 1:
            return None, 'error', f'{F_QUANTITY} must be at least 1'

    mode_input = (get(F_MODE) or 'QUEUE').upper()
    mode = MODE_ALIASES.get(mode_input)
    if mode is None:
        return None, 'error', f"Invalid {F_MODE}: '{get(F_MODE)}' (use Queue or Roaming)"

    active_user = None
    if get(F_STAFF_EMAIL):
        active_user = User.objects.filter(username__iexact=get(F_STAFF_EMAIL)).first()
        if not active_user:
            return None, 'error', f"Staff not found: {F_STAFF_EMAIL}='{get(F_STAFF_EMAIL)}'"

    issued_at_raw = get(F_ISSUED_AT)
    if not issued_at_raw:
        return None, 'error', f'{F_ISSUED_AT} is required'
    try:
        historical_dt = _parse_ph_datetime(issued_at_raw)
    except ValueError:
        return None, 'error', f"Invalid {F_ISSUED_AT} (expected YYYY-MM-DD HH:MM): '{issued_at_raw}'"

    reason = get(F_NOTES)
    if not reason:
        return None, 'error', f'{F_NOTES} is required'

    return {
        'vehicle': vehicle, 'driver': driver, 'route': route, 'mode': mode,
        'form': form, 'quantity': quantity, 'units': units, 'active_user': active_user,
        'historical_dt': historical_dt, 'reason': reason,
    }, 'ok', None


def _available_quantity(ticket_form_id):
    """Non-locking readonly estimate of how many tickets are left for a denomination —
    for preview/dry-run messaging only. The authoritative, race-safe count only ever
    happens inside _reserve_and_create's transaction via _consume_series_fifo."""
    series_list = TicketSeries.objects.filter(ticket_form_id=ticket_form_id, requisition__is_archived=False)
    return sum(
        max(int(s.end_no) - int(s.start_no) + 1 - s.tickets.count(), 0) for s in series_list
    )


def _reserve_and_create(resolved):
    """Reserves ticket numbers (unless the exact-number fallback already supplied one)
    and writes one Ticket row per unit. Must run at commit time only — this is where
    stock actually gets claimed."""
    with transaction.atomic():
        units = resolved['units']
        if units is None:
            units = _consume_series_fifo(resolved['form'].id, resolved['quantity'])
        tickets = []
        for series, ticket_id in units:
            ticket = Ticket.objects.create(
                id=ticket_id, vehicle=resolved['vehicle'], driver=resolved['driver'],
                route=resolved['route'], mode=resolved['mode'], series=series,
                status='COLLECTED', is_verified=True,
                collection_amount=resolved['form'].price, active_user=resolved['active_user'],
                active_user_name='' if resolved['active_user'] else 'Paper Backfill',
                dispatched_at=resolved['historical_dt'], reason=resolved['reason'],
            )
            # issued_at/created_at are auto_now_add=True — .create() always forces
            # them to now() regardless of what's passed in (Field.pre_save()). Only
            # a follow-up .update() (bypasses pre_save()) can backdate them, and it
            # must happen after .create() so the post_save sync signal still fires.
            Ticket.objects.filter(pk=ticket.pk).update(
                issued_at=resolved['historical_dt'], created_at=resolved['historical_dt']
            )
            tickets.append(ticket)
    return tickets


def _record_history(source, ticket_count, reason, issued_at, user):
    BackfillRecord.objects.create(
        source=source,
        created_by=user if user and getattr(user, 'is_authenticated', False) else None,
        created_by_name=str(user) if user and getattr(user, 'is_authenticated', False) else '',
        ticket_count=ticket_count,
        reason=reason,
        issued_at=issued_at,
    )


@api_view(['POST'])
@permission_classes([IsSupervisorOrAdminForWrite])
def backfill_manual(request):
    """Single-row entry. commit=false (default) previews without writing or reserving
    any ticket numbers."""
    commit = bool(request.data.get('commit'))
    resolved, outcome, reason = _resolve_batch(request.data)
    if outcome != 'ok':
        return Response({'outcome': outcome, 'reason': reason}, status=200)

    total_amount = float(resolved['form'].price) * resolved['quantity']
    ticket_ids = None
    if commit:
        try:
            tickets = _reserve_and_create(resolved)
        except ValidationError as exc:
            detail = exc.detail.get('quantity') if isinstance(exc.detail, dict) else exc.detail
            return Response({'outcome': 'error', 'reason': str(detail[0] if isinstance(detail, list) else detail)}, status=200)
        ticket_ids = [t.pk for t in tickets]
        record_audit_log(
            user=request.user, action='CREATE', model_name='Ticket',
            object_id=','.join(ticket_ids), object_repr=f"Manual backfill: {len(tickets)} ticket(s) for {resolved['vehicle']}",
            changes={'source': 'manual_backfill'},
        )
        _record_history('MANUAL', len(tickets), resolved['reason'], resolved['historical_dt'], request.user)

    return Response({
        'outcome': 'ok', 'committed': commit, 'ticket_ids': ticket_ids,
        'vehicle': resolved['vehicle'].plate_number, 'driver': str(resolved['driver']),
        'route': resolved['route'].full_name if resolved['route'] else None,
        'ticket_type': resolved['form'].name, 'quantity': resolved['quantity'],
        'unit_price': float(resolved['form'].price), 'total_amount': total_amount,
        'available': None if resolved['units'] else _available_quantity(resolved['form'].id),
    })


def _read_csv_rows(file_obj):
    if not file_obj:
        return None, Response({"error": "No file provided"}, status=400)
    try:
        # utf-8-sig strips a leading BOM — Excel's default CSV export includes one,
        # which would otherwise glue a stray character onto the first header name.
        decoded = file_obj.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        return None, Response({"error": "File must be UTF-8 encoded CSV"}, status=400)
    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = [f.strip() for f in (reader.fieldnames or [])]
    missing = [c for c in REQUIRED_CSV_COLUMNS if c not in fieldnames]
    if missing:
        return None, Response({"error": f"Missing required column(s): {', '.join(missing)}"}, status=400)
    return list(reader), None


def _read_batch_reason(request):
    """Notes/Import Reason applies to the whole CSV file, not per row — read from
    the top-level form field alongside the upload, not from a column. Date and
    Time Issued stays per row (see REQUIRED_CSV_COLUMNS)."""
    import_reason = (request.data.get('import_reason') or '').strip()
    if not import_reason:
        return None, Response({"error": "Import Reason is required"}, status=400)
    return import_reason, None


def _process_csv(rows, commit, import_reason):
    imported, errors = [], []
    for i, row in enumerate(rows, start=1):  # counts data rows only, header excluded
        row = {**row, F_NOTES: import_reason}
        resolved, outcome, reason = _resolve_batch(row)
        plate = (row.get(F_PLATE) or '').strip()
        if outcome != 'ok':
            errors.append({'row': i, 'vehicle': plate, 'reason': reason})
            continue
        if commit:
            try:
                tickets = _reserve_and_create(resolved)
            except ValidationError as exc:
                detail = exc.detail.get('quantity') if isinstance(exc.detail, dict) else exc.detail
                errors.append({'row': i, 'vehicle': plate, 'reason': str(detail[0] if isinstance(detail, list) else detail)})
                continue
            except Exception as exc:
                errors.append({'row': i, 'vehicle': plate, 'reason': f"Save failed: {exc}"})
                continue
            ticket_count = len(tickets)
        else:
            ticket_count = resolved['quantity']
        imported.append({
            'row': i, 'vehicle': resolved['vehicle'].plate_number, 'driver': str(resolved['driver']),
            'ticket_type': resolved['form'].name, 'quantity': ticket_count,
            'total_amount': float(resolved['form'].price) * ticket_count,
        })
    return {
        'total_rows': len(imported) + len(errors),
        'imported_count': len(imported), 'skipped_count': 0, 'error_count': len(errors),
        'imported': imported, 'skipped': [], 'errors': errors,
    }


@api_view(['POST'])
@permission_classes([IsSupervisorOrAdminForWrite])
def backfill_preview(request):
    rows, err = _read_csv_rows(request.FILES.get('file'))
    if err:
        return err
    import_reason, err = _read_batch_reason(request)
    if err:
        return err
    result = _process_csv(rows, commit=False, import_reason=import_reason)
    return Response({**result, 'dry_run': True})


@api_view(['POST'])
@permission_classes([IsSupervisorOrAdminForWrite])
def backfill_import(request):
    file_obj = request.FILES.get('file')
    rows, err = _read_csv_rows(file_obj)
    if err:
        return err
    import_reason, err = _read_batch_reason(request)
    if err:
        return err

    file_obj.seek(0)
    csv_bytes = file_obj.read()
    file_obj.seek(0)

    result = _process_csv(rows, commit=True, import_reason=import_reason)

    if result['imported_count']:
        BackfillRecord.objects.create(
            source='CSV',
            created_by=request.user if request.user and request.user.is_authenticated else None,
            created_by_name=str(request.user) if request.user and request.user.is_authenticated else '',
            ticket_count=sum(r['quantity'] for r in result['imported']),
            reason=import_reason,
            issued_at=None,  # varies per row — see BackfillRecord.issued_at's docstring
            csv_filename=file_obj.name,
            csv_file=ContentFile(csv_bytes, name=file_obj.name),
        )

    record_audit_log(
        user=request.user, action='CREATE', model_name='Ticket',
        object_id='', object_repr=f"CSV backfill ({file_obj.name})",
        changes={
            'imported_count': result['imported_count'],
            'error_count': result['error_count'],
        },
    )
    return Response({**result, 'dry_run': False})


@api_view(['GET'])
@permission_classes([IsSupervisorOrAdminForWrite])
def backfill_history(request):
    qs = BackfillRecord.objects.all()
    paged = paginate_request(request, qs)
    if paged is not None:
        page_num, page_size, total, sliced = paged
        return Response({
            'results': BackfillRecordSerializer(sliced, many=True).data,
            'count': total, 'page': page_num, 'page_size': page_size,
            'total_pages': max((total + page_size - 1) // page_size, 1),
        })
    return Response(BackfillRecordSerializer(qs[:100], many=True).data)


@api_view(['GET'])
@permission_classes([IsSupervisorOrAdminForWrite])
def backfill_history_download(request, record_id):
    try:
        record = BackfillRecord.objects.get(id=record_id)
    except BackfillRecord.DoesNotExist:
        return Response({"error": "Backfill record not found"}, status=404)
    if not record.csv_file:
        return Response({"error": "No CSV file stored for this entry"}, status=404)

    response = HttpResponse(record.csv_file.read(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{record.csv_filename or "backfill.csv"}"'
    return response
