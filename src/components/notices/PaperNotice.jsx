import { useState } from "react";
import { peso } from "../../app/dashboard/report/reportHook";

// Paper-issued tickets (downtime) were remitted at the treasury, outside iTURNO, so
// they're shown for the record but never counted in the day's cash to remit.
export default function PaperNotice({ count, amount }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !(Number(count) > 0)) return null;
  return (
    <div className="gnotice gnotice--wip">
      <span className="gnotice-text">
        {Number(count).toLocaleString()} paper ticket{Number(count) === 1 ? "" : "s"} ({peso(amount)}) issued outside the
        system (system down) — remitted at the treasury, not included in cash to remit.
      </span>
      <button type="button" className="gnotice-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
