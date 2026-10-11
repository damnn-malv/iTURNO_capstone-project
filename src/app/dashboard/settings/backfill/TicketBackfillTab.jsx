import React, { useState } from "react";
import { useToast, useConfirm } from "../../../../components/ui/ToastConfirmContext";
import { apiService, IS_REMOTE } from "../../../../lib/api-service";
import { useTicketBackfill } from "./useTicketBackfill";
import BackfillBuilder from "./BackfillBuilder";
import { F_PLATE, F_TICKET_TYPE, F_QUANTITY } from "./fields";

const MODES = [
  { value: "Queue", label: "Queue" },
  { value: "Roaming", label: "Roaming" },
];

export default function TicketBackfillTab() {
  const showToast = useToast();
  const showConfirm = useConfirm();
  const {
    wipMode, wipLoading, togglingWip, toggleWipMode,
    vehicles, ticketSeries, submitBusy, submitRows,
    remoteRequests, remoteRequestsLoading,
    history, historyLoading,
  } = useTicketBackfill();

  const [mode, setMode] = useState("Queue");

  const handleToggleWip = async () => {
    const turningOn = !wipMode?.is_active;
    if (turningOn) {
      const ok = await showConfirm(
        "Switch to WIP? No terminal will be able to check in or dispatch tickets until you switch back to Active."
      );
      if (!ok) return;
    }
    try {
      await toggleWipMode(turningOn);
      showToast(turningOn ? "Switched to WIP" : "Switched to Active", "success");
    } catch (err) {
      console.error("Failed to update WIP mode:", err);
      // err.message already carries the backend's actual reason (apiService.request()
      // extracts it from the response body) — show that instead of a generic line, since
      // whoever's using this screen won't have DevTools open to see the real cause.
      showToast(err.message || "Failed to update WIP mode", "info");
    }
  };

  const handleDownloadHistoryCsv = async (record) => {
    try {
      await apiService.downloadBackfillCsv(record.id, record.csv_filename);
    } catch (err) {
      console.error("Failed to download backfill CSV:", err);
      showToast(err.message || "Failed to download this file", "info");
    }
  };

  return (
    <div className="tbf-tab">
      {/* WIP status */}
      <div className="tbf-wip-section">
        <span className={`tbf-pill ${wipMode?.is_active ? "tbf-pill--wip" : "tbf-pill--active"}`}>
          {wipLoading ? "…" : wipMode?.is_active ? "WIP" : "Active"}
        </span>
        {!IS_REMOTE && (
          <button className="set-add-btn" onClick={handleToggleWip} disabled={wipLoading || togglingWip}>
            {wipMode?.is_active ? "Switch to Active" : "Switch to WIP"}
          </button>
        )}
        {wipMode?.updated_at && (
          <span className="tbf-meta">Last changed {new Date(wipMode.updated_at).toLocaleString()}</span>
        )}
      </div>
      <p className="set-rewards-note">
        WIP pauses ticket issuance system-wide — every terminal is blocked from checking in or
        dispatching tickets while WIP is on. Use it while backfilling paper tickets below, then
        switch back to Active when done. Ticket numbers are assigned automatically from the
        selected Ticket Series — they're never typed in.
        {IS_REMOTE && " Switching WIP on or off only works from the LAN terminal itself."}
      </p>

      {!IS_REMOTE && !wipLoading && !wipMode?.is_active && (
        <div className="tbf-nudge">
          <span>Currently Active — consider switching to WIP before importing to avoid collisions with live ticket issuance.</span>
        </div>
      )}
      {IS_REMOTE && !wipLoading && !wipMode?.is_active && (
        <div className="tbf-nudge">
          <span>Remote backfill needs WIP mode active first — switch it on from the LAN terminal, then come back here.</span>
        </div>
      )}

      {/* Mode switch */}
      <div className="tbf-mode-switch">
        {MODES.map((m) => (
          <button
            key={m.value}
            className={`tbf-mode-btn ${mode === m.value ? "tbf-mode-btn--active" : ""}`}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {IS_REMOTE && !wipLoading && !wipMode?.is_active && (
        <p className="set-rewards-note">Waiting on WIP mode — the form below unlocks once it's active.</p>
      )}

      {/* Both stay mounted so switching tabs doesn't lose what's been entered. */}
      {(!IS_REMOTE || wipMode?.is_active) && MODES.map((m) => (
        <div key={m.value} hidden={mode !== m.value}>
          <BackfillBuilder
            mode={m.value}
            vehicles={vehicles}
            ticketSeries={ticketSeries}
            busy={submitBusy}
            submitRows={submitRows}
          />
        </div>
      ))}

      {IS_REMOTE && (
        <div className="tbf-remote-requests">
          <h4>Recent remote backfill requests</h4>
          {remoteRequestsLoading ? (
            <p className="set-rewards-note">Loading…</p>
          ) : remoteRequests.length === 0 ? (
            <p className="set-rewards-note">No requests queued yet.</p>
          ) : (
            <table className="set-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Ticket Type</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Requested by</th>
                  <th>Submitted</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {remoteRequests.map((r) => (
                  <tr key={r.id} className="set-row">
                    <td className="set-cell-label">{r.payload?.[F_PLATE]}</td>
                    <td>{r.payload?.[F_TICKET_TYPE]}</td>
                    <td>{r.payload?.[F_QUANTITY] || 1}</td>
                    <td>{r.status}</td>
                    <td className="set-cell-meta">{r.requested_by_name}</td>
                    <td className="set-cell-meta">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="set-cell-meta">{r.result_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!IS_REMOTE && (
        <div className="tbf-history">
          <h4>Backfill history</h4>
          {historyLoading ? (
            <p className="set-rewards-note">Loading…</p>
          ) : history.length === 0 ? (
            <p className="set-rewards-note">No backfills recorded yet.</p>
          ) : (
            <table className="set-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Backfilled by</th>
                  <th>Source</th>
                  <th>Tickets</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="set-row">
                    <td className="set-cell-meta">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="set-cell-label">{r.created_by_name || "System"}</td>
                    <td>{r.source_display}</td>
                    <td>{r.ticket_count}</td>
                    <td className="set-cell-meta">{r.reason}</td>
                    <td>
                      {r.has_csv && (
                        <button className="set-add-btn" onClick={() => handleDownloadHistoryCsv(r)}>
                          Download CSV
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
