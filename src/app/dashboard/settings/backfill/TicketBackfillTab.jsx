import React, { useState } from "react";
import { useToast, useConfirm } from "../../../../components/ui/ToastConfirmContext";
import { apiService, IS_REMOTE } from "../../../../lib/api-service";
import { useTicketBackfill } from "./useTicketBackfill";
import BackfillResults from "./BackfillResults";
import {
  F_TICKET_ID, F_PLATE, F_TICKET_TYPE, F_QUANTITY, F_ISSUED_AT, F_STAFF_EMAIL, F_MODE, F_NOTES,
} from "./fields";

function toBackendDateTime(localDateTimeValue) {
  // <input type="datetime-local"> gives "YYYY-MM-DDTHH:MM" — backend wants
  // "YYYY-MM-DD HH:MM" (see backend/api/views/backfill.py _parse_ph_datetime).
  if (!localDateTimeValue) return "";
  return localDateTimeValue.replace("T", " ");
}

const CSV_TEMPLATE_HEADER = [F_PLATE, F_TICKET_TYPE, F_QUANTITY, F_ISSUED_AT, F_STAFF_EMAIL, F_MODE];

// The example lives only on-screen (the guide table below), not in the
// downloaded file — a filled-in row 2 in the actual template invites someone
// unfamiliar with spreadsheets to leave it there and start typing in row 3,
// or edit it in place instead of replacing it. The download is header-only.
const CSV_COLUMN_REFERENCE = [
  { name: F_PLATE, required: true, example: "ABC-123", note: "Must match a vehicle's plate number exactly. Driver and route are filled in automatically from that vehicle — the vehicle must have a registered owner." },
  { name: F_TICKET_TYPE, required: true, example: "Cash Tickets@10", note: "The ticket type name — sets the price and which ticket series to draw numbers from." },
  { name: F_QUANTITY, required: true, example: "5", note: "How many physical tickets of this type to record for this vehicle, e.g. 5 pcs of a ₱2 ticket = 5 tickets, ₱10 total. Numbers are auto-assigned, never typed in." },
  { name: F_ISSUED_AT, required: true, example: "2026-08-20 09:15", note: "When the paper ticket was actually issued, from the route's own log book. Format: YYYY-MM-DD HH:MM (24-hour clock)." },
  { name: F_STAFF_EMAIL, required: false, example: "(leave blank)", note: "The login email of the staff member who issued it. Leave blank to label it \"Paper Backfill\"." },
  { name: F_MODE, required: false, example: "Queue", note: "Queue or Roaming (matches the Queue Management page). Leave blank for Queue." },
];

function downloadCsvTemplate() {
  const csv = CSV_TEMPLATE_HEADER.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ticket_backfill_template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TicketBackfillTab() {
  const showToast = useToast();
  const showConfirm = useConfirm();
  const {
    wipMode, wipLoading, togglingWip, toggleWipMode,
    vehicles, ticketForms,
    manualRow, manualPreview, manualBusy, updateManualField, resetManualRow, previewManualRow, confirmManualRow,
    csvFile, setCsvFile, csvReport, csvBusy, previewCsv, importCsv, resetCsv,
    remoteRequests, remoteRequestsLoading,
    history, historyLoading,
  } = useTicketBackfill();

  const [mode, setMode] = useState("manual");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [issuedAtLocal, setIssuedAtLocal] = useState("");
  const [useExactTicketNumber, setUseExactTicketNumber] = useState(false);

  const [csvImportReason, setCsvImportReason] = useState("");

  const vehicleResults = vehicles.filter((v) =>
    v.plate_number?.toLowerCase().includes(vehicleSearch.toLowerCase())
  ).slice(0, 20);

  // Driver and route aren't picked by hand — they're whatever the selected
  // vehicle is already registered with (Vehicle.owner_driver / Vehicle.route),
  // so both are derived here rather than left as manual fields.
  const selectedVehicle = vehicles.find(
    (v) => v.plate_number?.toLowerCase() === vehicleSearch.trim().toLowerCase()
  );

  const handleSelectVehicle = (vehicle) => {
    updateManualField(F_PLATE, vehicle.plate_number);
    setVehicleSearch(vehicle.plate_number);
    setShowVehicleDropdown(false);
  };

  const handleClearManualForm = () => {
    resetManualRow();
    setVehicleSearch("");
    setIssuedAtLocal("");
    setUseExactTicketNumber(false);
  };

  const handleIssuedAtChange = (value) => {
    setIssuedAtLocal(value);
    updateManualField(F_ISSUED_AT, toBackendDateTime(value));
  };

  const handleToggleExactTicketNumber = (checked) => {
    setUseExactTicketNumber(checked);
    if (!checked) {
      updateManualField(F_TICKET_ID, "");
      updateManualField(F_QUANTITY, "1");
    }
  };

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

  const handlePreviewManual = async () => {
    try {
      const result = await previewManualRow();
      if (result.outcome !== "ok") {
        showToast(result.reason || "Row could not be validated", "info");
      }
    } catch (err) {
      console.error("Failed to preview manual entry:", err);
      showToast(err.message || "Failed to preview this entry", "info");
    }
  };

  const handleConfirmManual = async () => {
    const ok = await showConfirm(
      IS_REMOTE
        ? "Queue this backfill? The LAN terminal creates it on its next sync."
        : "Add this backfill? This creates real record(s)."
    );
    if (!ok) return;
    try {
      const result = await confirmManualRow();
      if (result.outcome === "ok") {
        showToast(
          result.queued
            ? "Backfill queued"
            : `${result.ticket_ids?.length || 1} ticket(s) added`,
          "success"
        );
        setVehicleSearch("");
        setIssuedAtLocal("");
        setUseExactTicketNumber(false);
      } else {
        showToast(result.reason || "Could not add this backfill", "info");
      }
    } catch (err) {
      console.error("Failed to add manual entry:", err);
      showToast(err.message || "Failed to add this backfill", "info");
    }
  };

  const handlePreviewCsv = async () => {
    if (!csvImportReason.trim()) {
      showToast("Import Reason is required", "info");
      return;
    }
    try {
      await previewCsv(csvImportReason.trim());
    } catch (err) {
      console.error("Failed to preview CSV:", err);
      showToast(err.message || "Failed to preview this file", "info");
    }
  };

  const handleImportCsv = async () => {
    const ok = await showConfirm(
      `Import ${csvReport?.imported_count ?? 0} row(s) from this file? Invalid rows are skipped automatically.`
    );
    if (!ok) return;
    try {
      const result = await importCsv(csvImportReason.trim());
      showToast(`Imported ${result.imported_count} row(s)`, "success");
    } catch (err) {
      console.error("Failed to import CSV:", err);
      showToast(err.message || "Failed to import this file", "info");
    }
  };

  const handleResetCsv = () => {
    resetCsv();
    setCsvImportReason("");
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
        selected Ticket Type's series — they're never typed in.
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
        <button
          className={`tbf-mode-btn ${mode === "manual" ? "tbf-mode-btn--active" : ""}`}
          onClick={() => setMode("manual")}
        >
          Single Entry
        </button>
        <button
          className={`tbf-mode-btn ${mode === "csv" ? "tbf-mode-btn--active" : ""}`}
          onClick={() => setMode("csv")}
        >
          CSV Upload
        </button>
      </div>

      {mode === "manual" && IS_REMOTE && !wipLoading && !wipMode?.is_active && (
        <p className="set-rewards-note">Waiting on WIP mode — the form below unlocks once it's active.</p>
      )}

      {mode === "manual" && (!IS_REMOTE || wipMode?.is_active) && (
        <div className="tbf-manual-form">
          <div className="set-add-row">
            <label className="set-field tbf-searchable">
              <span className="set-field-label">Vehicle Plate Number *</span>
              <input
                className="set-input"
                value={vehicleSearch}
                onChange={(e) => {
                  // Keep the field synced to whatever's typed, not just an actual
                  // dropdown pick — otherwise a typo or a missed selection submits an
                  // EMPTY value, and the resulting "Vehicle not found: ...=''" error
                  // doesn't match what the user still sees sitting in this box.
                  setVehicleSearch(e.target.value);
                  setShowVehicleDropdown(true);
                  updateManualField(F_PLATE, e.target.value);
                }}
                onFocus={() => setShowVehicleDropdown(true)}
                placeholder="Search plate number..."
              />
              {showVehicleDropdown && vehicleSearch && (
                <div className="tbf-dropdown">
                  {vehicleResults.length === 0 ? (
                    <div className="tbf-dropdown-empty">No matches</div>
                  ) : vehicleResults.map((v) => (
                    <div
                      key={v.id}
                      className="tbf-dropdown-item"
                      // Without this, mousedown briefly blurs the still-focused input,
                      // which fires onFocus again right after the click sets
                      // showVehicleDropdown(false) — silently reopening the dropdown and
                      // leaving a stale item there to trip up the next field's selector.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectVehicle(v)}
                    >
                      {v.plate_number} {v.owner_driver_name ? `— ${v.owner_driver_name}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </label>

            <label className="set-field">
              <span className="set-field-label">Ticket Type *</span>
              <select
                className="set-input"
                value={manualRow[F_TICKET_TYPE]}
                onChange={(e) => updateManualField(F_TICKET_TYPE, e.target.value)}
              >
                <option value="">— select —</option>
                {ticketForms.map((tf) => (
                  <option key={tf.id} value={tf.name}>{tf.name} (₱{Number(tf.price).toFixed(2)})</option>
                ))}
              </select>
            </label>

            <label className="set-field">
              <span className="set-field-label">Ticket Amount (pcs) *</span>
              <input
                type="number"
                min="1"
                step="1"
                className="set-input"
                value={manualRow[F_QUANTITY]}
                onChange={(e) => updateManualField(F_QUANTITY, e.target.value)}
                disabled={useExactTicketNumber}
              />
            </label>
          </div>

          {selectedVehicle && !selectedVehicle.owner_driver_name && (
            <p className="tbf-warning">
              This vehicle has no registered owner — set one on the Fleet & Driver page before backfilling.
            </p>
          )}
          {selectedVehicle?.owner_driver_name && (
            <p className="set-rewards-note">
              Driver: {selectedVehicle.owner_driver_name}
              {selectedVehicle.route_detail ? ` — Route: ${selectedVehicle.route_detail.origin}` : ""}
              {" "}(filled in automatically from this vehicle)
            </p>
          )}

          <div className="set-add-row">
            <label className="set-field">
              <span className="set-field-label">Date and Time Issued *</span>
              <input
                type="datetime-local"
                className="set-input"
                value={issuedAtLocal}
                onChange={(e) => handleIssuedAtChange(e.target.value)}
              />
            </label>
            <label className="set-field">
              <span className="set-field-label">Staff Email</span>
              <input
                className="set-input"
                value={manualRow[F_STAFF_EMAIL] || ""}
                onChange={(e) => updateManualField(F_STAFF_EMAIL, e.target.value)}
                placeholder='Leave blank for "Paper Backfill"'
              />
            </label>
          </div>

          <div className="set-add-row">
            <label className="set-field">
              <span className="set-field-label">Notes *</span>
              <input
                className="set-input"
                value={manualRow[F_NOTES]}
                onChange={(e) => updateManualField(F_NOTES, e.target.value)}
                placeholder="Why this is being backfilled, e.g. system outage 2026-08-20"
              />
            </label>
          </div>

          <label className="tbf-advanced-toggle">
            <input
              type="checkbox"
              checked={useExactTicketNumber}
              onChange={(e) => handleToggleExactTicketNumber(e.target.checked)}
            />
            I have the exact physical ticket number (rare — for reconciling a ticket from an already-archived booklet)
          </label>

          {useExactTicketNumber && (
            <div className="set-add-row">
              <label className="set-field">
                <span className="set-field-label">Ticket Number *</span>
                <input
                  className="set-input"
                  value={manualRow[F_TICKET_ID]}
                  onChange={(e) => updateManualField(F_TICKET_ID, e.target.value)}
                  placeholder="Physical ticket number"
                />
              </label>
            </div>
          )}

          {!IS_REMOTE && manualPreview && manualPreview.outcome === "ok" && (
            <div className="tbf-preview-line">
              Will {manualPreview.committed ? "record" : "create"} {manualPreview.quantity} ticket(s) for{" "}
              {manualPreview.vehicle} / {manualPreview.driver}
              {manualPreview.route ? ` on ${manualPreview.route}` : ""} — {manualPreview.ticket_type} —{" "}
              ₱{manualPreview.total_amount.toFixed(2)} total
              {manualPreview.available != null ? ` (${manualPreview.available} available)` : ""}
            </div>
          )}

          <div className="set-add-row">
            {!IS_REMOTE && (
              <button
                className="set-add-btn"
                onClick={handlePreviewManual}
                disabled={
                  manualBusy || !manualRow[F_PLATE] || !manualRow[F_TICKET_TYPE] ||
                  (useExactTicketNumber && !manualRow[F_TICKET_ID])
                }
              >
                Preview
              </button>
            )}
            <button
              className="set-add-btn"
              onClick={handleConfirmManual}
              disabled={
                manualBusy || (useExactTicketNumber && !manualRow[F_TICKET_ID]) ||
                (IS_REMOTE
                  ? !manualRow[F_PLATE] || !manualRow[F_TICKET_TYPE] || !manualRow[F_ISSUED_AT] || !manualRow[F_NOTES]
                  : !manualPreview || manualPreview.outcome !== "ok")
              }
            >
              {IS_REMOTE ? "Queue for Backfill" : "Confirm & Add"}
            </button>
            <button className="set-delete-btn" onClick={handleClearManualForm} disabled={manualBusy}>
              Clear
            </button>
          </div>

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
        </div>
      )}

      {mode === "csv" && (
        <div className="tbf-csv-form">
          <div className="set-add-row">
            <button className="set-add-btn" onClick={downloadCsvTemplate} type="button">
              Download CSV Template
            </button>
            <span className="tbf-meta">Required columns: {F_PLATE}, {F_TICKET_TYPE}, {F_QUANTITY}, {F_ISSUED_AT}. See the column guide below.</span>
          </div>

          <div className="set-add-row">
            <label className="set-field">
              <span className="set-field-label">Import Reason *</span>
              <input
                className="set-input"
                value={csvImportReason}
                onChange={(e) => setCsvImportReason(e.target.value)}
                placeholder="Why this whole file is being backfilled, e.g. digitizing the San Fernando route log book"
                disabled={csvReport && !csvReport.dry_run}
              />
            </label>
          </div>
          <p className="set-rewards-note">
            Applies to every ticket this file creates. Date and Time Issued stays a per-row column below —
            each route's log book has its own real timestamps, so they aren't lumped into one shared value.
          </p>

          <div className="set-add-row">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { setCsvFile(e.target.files?.[0] || null); }}
            />
            <button className="set-add-btn" onClick={handlePreviewCsv} disabled={csvBusy || !csvFile}>
              Preview Import
            </button>
            <button
              className="set-add-btn"
              onClick={handleImportCsv}
              disabled={csvBusy || !csvReport?.dry_run || csvReport.imported_count === 0}
              title={!csvReport?.dry_run ? "Run Preview Import first" : undefined}
            >
              {csvReport?.dry_run
                ? `Confirm & Import ${csvReport.imported_count} Row(s)`
                : "Confirm & Import (preview first)"}
            </button>
            {csvReport && !csvReport.dry_run && (
              <button className="set-delete-btn" onClick={handleResetCsv} disabled={csvBusy}>
                Start New Import
              </button>
            )}
          </div>

          <BackfillResults report={csvReport} />

          <div className="tbf-csv-reference">
            <h4>CSV column guide</h4>
            <p className="set-rewards-note">
              The downloaded template only has the header row — here's an example of what a
              filled-in row looks like for each column.
            </p>
            <table className="set-table">
              <thead>
                <tr><th>Column</th><th>Required</th><th>Example</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {CSV_COLUMN_REFERENCE.map((col) => (
                  <tr key={col.name}>
                    <td className="set-cell-label">{col.name}</td>
                    <td>{col.required ? "Yes" : "Optional"}</td>
                    <td className="tbf-example-cell">{col.example}</td>
                    <td>{col.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
