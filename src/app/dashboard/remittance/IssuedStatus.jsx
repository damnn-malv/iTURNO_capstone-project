import { peso } from "../report/reportHook";

// "2026-06-05" -> "Jun 5"; parsed as a local date so the day never shifts by timezone.
const formatDay = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function IssuedStatus({ date, isLate, data, loading }) {
  const label = isLate ? `Issued Last ${formatDay(date)}` : "Issued Today";
  // Only what's still unremitted: once recorded batches cover the expected cash, nothing is left to file.
  const pending = Number(data?.difference) > 0;
  const count = pending ? Number(data.checkout_count) : 0;

  return (
    <div className="rpt-summary-row rem-issued">
      <div className="rpt-summary-card">
        <span className="rpt-summary-label">{label}</span>
        <div className="rpt-summary-count">{loading ? "…" : <>{count} <span className="rem-count-unit">{count === 1 ? "ticket" : "tickets"}</span></>}</div>
      </div>
      <div className="rpt-summary-card">
        <span className="rpt-summary-label">Cash to Remit</span>
        <div className="rpt-summary-total">{loading ? "…" : peso(pending ? data.difference : 0)}</div>
      </div>
    </div>
  );
}
