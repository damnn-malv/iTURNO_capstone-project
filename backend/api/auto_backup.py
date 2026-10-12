import logging
import os
import sys
import threading
import time
from datetime import timedelta

from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone

logger = logging.getLogger("sync")

SCHEDULED_LABEL = "Scheduled daily backup"
CHECK_EVERY_SECONDS = 3600


def _run_once():
    from .models import BackupRecord
    from .views.system import _backup_path, _create_backup_file

    interval = timedelta(hours=settings.AUTO_BACKUP_INTERVAL_HOURS)
    scheduled = BackupRecord.objects.filter(source="AUTO", label=SCHEDULED_LABEL).order_by("-created_at")
    latest = scheduled.first()
    if latest and timezone.now() - latest.created_at < interval:
        return

    _create_backup_file(None, label=SCHEDULED_LABEL, source="AUTO")
    for old in scheduled[settings.AUTO_BACKUP_KEEP:]:
        default_storage.delete(_backup_path(old.filename))
        old.delete()


def _loop():
    from django.db import close_old_connections

    while True:
        try:
            close_old_connections()
            _run_once()
        except Exception:
            logger.exception("scheduled backup failed")
        time.sleep(CHECK_EVERY_SECONDS)


def start():
    """Start the scheduler inside the dev server process only (not migrate/shell/etc., not the autoreload parent)."""
    if settings.AUTO_BACKUP_KEEP <= 0 or "runserver" not in sys.argv:
        return
    if "--noreload" not in sys.argv and os.environ.get("RUN_MAIN") != "true":
        return
    threading.Thread(target=_loop, name="auto-backup", daemon=True).start()
