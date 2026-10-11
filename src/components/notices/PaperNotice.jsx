import { peso } from "../../app/dashboard/report/reportHook";

// Paper-issued tickets (downtime) were remitted at the treasury, outside iTURNO, so
// they're shown for the record but never counted in the day's cash to remit.
export default function PaperNotice({ count, amount }) {
  if (!(Number(count) > 0)) return null;
  return (
    <div className="gnotice gnotice--wip">
      <span className="gnotice-text">
        {Number(count).toLocaleString()} paper ticket{Number(count) === 1 ? "" : "s"} ({peso(amount)}) issued outside the
        system (system down) — remitted at the treasury, not included in cash to remit.
      </span>
    </div>
  );
}
