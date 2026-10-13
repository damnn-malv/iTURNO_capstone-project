import { Fragment, useEffect, useState } from "react";
import { DataTable } from "../../../../components/ui/dataTable";
import { apiService, IS_REMOTE } from "../../../../lib/api-service";
import { useFeedback } from "../../../../components/ui/kit";
import Pager from "./Pager";

const COLUMNS = ["When", "Backfilled by", "Source", "Tickets", "Reason", ""];
const PAGE_SIZE = 10;
const peso = (n) => `₱${Number(n || 0).toFixed(2)}`;

// LAN-only: the stored CSV lives on the LAN's local disk and isn't mirrored to Supabase.
export default function BackfillHistory() {
  const { notify } = useFeedback();
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (IS_REMOTE) return;
    apiService
      .getBackfillHistory()
      .then((r) => setHistory(Array.isArray(r) ? r : r.results || []))
      .catch((err) => notify.error({ title: "Couldn't load backfill history", message: err?.message || "Check your connection and try again." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (IS_REMOTE) return null;

  const download = (r) =>
    apiService.downloadBackfillCsv(r.id, r.csv_filename).catch((err) => notify.error({
      title: "Couldn't download the CSV",
      message: err?.message || "Check your connection and try again.",
      onRetry: () => download(r),
    }));

  const renderRow = (r, _i, { rowClass, cellClass }) => {
    const canOpen = r.entries?.length > 0;
    const isOpen = openId === r.id;
    return (
      <Fragment key={r.id}>
        <tr className={rowClass} style={canOpen ? { cursor: "pointer" } : undefined} onClick={() => canOpen && setOpenId(isOpen ? null : r.id)}>
          <td className={`${cellClass} rpt-mono rpt-muted`}>{canOpen ? (isOpen ? "▾ " : "▸ ") : ""}{new Date(r.created_at).toLocaleString()}</td>
          <td className={cellClass}>{r.created_by_name || "System"}</td>
          <td className={cellClass}>{r.source_display}</td>
          <td className={cellClass}>{r.ticket_count}</td>
          <td className={`${cellClass} rpt-muted`}>{r.reason}</td>
          <td className={cellClass}>
            {r.has_csv && (
              <button className="rpt-btn rpt-btn--secondary" onClick={(e) => { e.stopPropagation(); download(r); }}>
                Download CSV
              </button>
            )}
          </td>
        </tr>
        {isOpen && (
          <tr>
            <td colSpan={COLUMNS.length} className={cellClass}>
              <DataTable
                columns={["#", "Ticket #", "Time", "Vehicle", "Driver / Route", "Amount"]}
                data={r.entries}
                rowRenderer={(e, i, c) => (
                  <tr key={e.ticket_id} className={c.rowClass}>
                    <td className={c.cellClass}>{i + 1}</td>
                    <td className={c.cellClass}>#{e.ticket_id}</td>
                    <td className={c.cellClass}>{e.time?.slice(11)}</td>
                    <td className={c.cellClass}>{e.vehicle}</td>
                    <td className={c.cellClass}>{e.driver}{e.route ? ` — ${e.route}` : ""}</td>
                    <td className={c.cellClass}>{peso(e.amount)}</td>
                  </tr>
                )}
              />
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const totalPages = Math.max(Math.ceil(history.length / PAGE_SIZE), 1);
  const rows = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="rpt-card rpt-section">
      <div className="rpt-card-header">
        <div className="rpt-card-header-left">
          <div className="rpt-tab-group">
            <button className="rpt-tab rpt-tab--active">Backfill History</button>
          </div>
          <span className="rpt-record-count">{history.length} records</span>
        </div>
      </div>
      <DataTable columns={COLUMNS} data={rows} rowRenderer={renderRow} />
      <Pager page={page} totalPages={totalPages} count={history.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
}
