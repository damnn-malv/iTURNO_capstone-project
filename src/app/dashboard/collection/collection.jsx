import React, { useState } from "react";
import {
  useCollection,
  formatTime,
  BatchCard,
} from "../../../lib/collection/useCollection";
import { OperationsService } from "../../../lib/operations-service";
import { useShifts } from "../../../lib/useShifts";
import "../../../styles/Collection.css";

function Collection({ userRole }) {
  const {
    shifts,
    loading: shiftsLoading,
    error: shiftsError,
    updateShifts,
  } = useShifts();
  const {
    tickets,
    filteredTickets,
    searchTerm,
    loading,
    error,
    batchStats,
    verifyingBatch,
    verifyingTicketId,
    successMessage,
    setSearchTerm,
    handleVerifyBatch,
    handleVerifyTicket,
    isBatchVerifiable,
  } = useCollection(shifts);

  const [currentPage, setCurrentPage] = useState(1);
  const [isUnverifiedModalOpen, setIsUnverifiedModalOpen] = useState(false);
  const [confirmingBatchKey, setConfirmingBatchKey] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingShifts, setEditingShifts] = useState({});
  const rowsPerPage = 15;
  const unverifiedTickets = tickets.filter(
    (t) => !t.is_verified && t.status !== "CANCELLED",
  );
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentTickets = filteredTickets.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredTickets.length / rowsPerPage);

  const handleVerifyBatchWithConfirm = (batchKey) => {
    setConfirmingBatchKey(batchKey);
  };

  const confirmBatchVerification = () => {
    if (confirmingBatchKey) {
      handleVerifyBatch(confirmingBatchKey);
      setConfirmingBatchKey(null);
    }
  };

  const formatLabel = (name, startHour, endHour) => {
    const start =
      startHour < 12
        ? `${startHour}am`
        : startHour === 12
          ? "12pm"
          : `${startHour - 12}pm`;
    const end =
      endHour < 12
        ? `${endHour}am`
        : endHour === 12
          ? "12pm"
          : `${endHour - 12}pm`;
    return `${name} (${start}-${end})`;
  };

  const handleScheduleFieldChange = (key, field, value) => {
    setEditingShifts((prev) => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]:
            field === "startHour" || field === "endHour"
              ? Number(value)
              : value,
        },
      };
      // Recalculate label if startHour or endHour changed
      if (field === "startHour" || field === "endHour") {
        updated[key].label = formatLabel(
          updated[key].name,
          updated[key].startHour,
          updated[key].endHour,
        );
      }
      return updated;
    });
  };

  const handleSaveSchedule = async () => {
    try {
      await updateShifts(editingShifts);
      setIsScheduleModalOpen(false);
    } catch (err) {
      console.error("Failed to save schedule", err);
    }
  };

  const batchKeys = Object.keys(shifts || {});

  return (
    <div className="col-page">
      {/* Header */}
      <div className="col-header">
        <div className="col-header-left">
          <div className="col-header-accent" />
          <div>
            <h1 className="col-title">Tally &amp; Collections</h1>
            <p className="col-subtitle">
              Automated revenue recording — ₱10 per dispatch
            </p>
          </div>
        </div>
        <div>
          <button
            className="col-schedule-btn"
            onClick={() => {
              setEditingShifts(JSON.parse(JSON.stringify(shifts)));
              setIsScheduleModalOpen(true);
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Batch Schedule
            <span className="col-schedule-btn__edit">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </span>
          </button>
        </div>
      </div>

      {(error || shiftsError) && (
        <div className="col-alert col-alert--error">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error || shiftsError}
        </div>
      )}

      {successMessage && (
        <div className="col-alert col-alert--success">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {successMessage}
        </div>
      )}

      <div className="col-grid">
        {/* ── Left: Shift Tally ── */}
        <div className="col-tally">
          {batchKeys.length > 0 ? (
            batchKeys.map((key) => {
              const shift = shifts[key];
              return (
                <BatchCard
                  key={key}
                  label={`${shift.name} — ${shift.label}`}
                  stats={batchStats?.[key]}
                  batchKey={shift.name}
                  onVerify={handleVerifyBatchWithConfirm}
                  verifyingBatch={verifyingBatch}
                />
              );
            })
          ) : (
            <div className="col-shift-loading">
              {shiftsLoading
                ? "Loading schedule..."
                : "No shift configuration found."}
            </div>
          )}
          {userRole === "ADMIN" && (
            <button
              type="button"
              className="col-override-btn"
              onClick={() => setIsUnverifiedModalOpen(true)}
            >
              Override
            </button>
          )}
        </div>

        {/* ── Right: Collection Log ── */}
        <div className="col-card col-log-card">
          <div className="col-card-header col-card-header--color col-log-header">
            <div>
              <span className="col-card-title">Collection Log</span>
              <p className="col-card-desc">
                Recent collections and verification status
              </p>
            </div>
            <div className="col-search-wrap">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="col-search-icon"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                className="col-search"
                placeholder="Search tickets…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="col-table-wrap">
            <table className="col-table">
              <thead>
                <tr>
                  {[
                    "Ticket ID",
                    "Batch",
                    "Time",
                    "Vehicle",
                    "Driver",
                    "Verified",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="col-table-state">
                      <div className="col-loading-dots">
                        <div />
                        <div />
                        <div />
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="col-table-state col-table-state--error"
                    >
                      Error: {error}
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="col-table-state">
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        opacity="0.3"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>No records found</span>
                    </td>
                  </tr>
                ) : (
                  currentTickets.map((ticket) => {
                    const effectiveBatch =
                      OperationsService.getEffectiveBatchName(ticket, shifts);
                    return (
                      <tr
                        key={ticket.id}
                        className={`col-table-row ${ticket.is_late ? "col-table-row--late" : ""}`}
                      >
                        <td>
                          <span className="col-id-badge">#{ticket.id}</span>
                        </td>
                        <td>
                          <div className="col-batch-cell">
                            <span className="col-batch-name">
                              {effectiveBatch}
                            </span>
                            {ticket.is_late && (
                              <span className="col-late-tag">
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                  <path d="M12 9v4" />
                                  <path d="M12 17h.01" />
                                </svg>
                                Late
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="col-td-time">
                          {formatTime(ticket.issued_at)}
                        </td>
                        <td>
                          {ticket.vehicle?.plate_number ? (
                            <span className="col-plate">
                              {ticket.vehicle.plate_number}
                            </span>
                          ) : (
                            <span className="col-na">N/A</span>
                          )}
                        </td>
                        <td className="col-td-name">
                          {ticket.driver?.name || (
                            <span className="col-na">N/A</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`col-verified ${
                              ticket.status === "CANCELLED"
                                ? "col-verified--cancelled"
                                : ticket.is_verified
                                  ? "col-verified--yes"
                                  : "col-verified--pending"
                            }`}
                          >
                            {ticket.status === "CANCELLED"
                              ? "✗ Cancelled"
                              : ticket.is_verified
                                ? "✓ Verified"
                                : "○ Pending"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredTickets.length > rowsPerPage && (
            <div className="col-pagination">
              <span className="col-pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <div className="col-pagination-btns">
                <button
                  className="col-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ← Prev
                </button>
                <button
                  className="col-page-btn"
                  disabled={endIndex >= filteredTickets.length}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmingBatchKey && (
        <div
          className="col-sched-overlay"
          onClick={() => setConfirmingBatchKey(null)}
        >
          <div className="col-sched-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="col-sched-modal-header">
              <div className="col-sched-modal-header-left">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c9a84c"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h2 className="col-sched-modal-title">Confirm Verification</h2>
              </div>
              <button
                type="button"
                className="col-sched-modal-close"
                onClick={() => setConfirmingBatchKey(null)}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="col-sched-modal-body">
              <div className="col-sched-batch-label-row">
                <span className="col-sched-batch-name">Batch</span>
                <span className="col-sched-batch-preview">
                  {confirmingBatchKey}
                </span>
              </div>

              <p className="col-sched-note" style={{ marginTop: 12 }}>
                All pending tickets in <strong>{confirmingBatchKey}</strong>{" "}
                will be marked as verified. This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="col-sched-modal-footer">
              <button
                type="button"
                className="col-sched-modal-btn col-sched-modal-btn--cancel"
                onClick={() => setConfirmingBatchKey(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="col-sched-modal-btn col-sched-modal-btn--submit"
                onClick={confirmBatchVerification}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Yes, Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {isUnverifiedModalOpen && (
        <div
          className="col-overlay"
          onClick={() => setIsUnverifiedModalOpen(false)}
        >
          <div className="col-modal" onClick={(e) => e.stopPropagation()}>
            <div className="col-modal-header">
              <div>
                <h2 className="col-modal-title">Unverified Tickets</h2>
                <p className="col-modal-subtitle">
                  All tickets that are not verified yet.
                </p>
              </div>
              <button
                type="button"
                className="col-modal-close"
                onClick={() => setIsUnverifiedModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="col-modal-body">
              <div className="col-table-wrap">
                <table className="col-table">
                  <thead>
                    <tr>
                      {[
                        "Ticket ID",
                        "Batch",
                        "Time",
                        "Vehicle",
                        "Driver",
                        "Action",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unverifiedTickets.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="col-table-state">
                          No unverified tickets to show.
                        </td>
                      </tr>
                    ) : (
                      unverifiedTickets.map((ticket) => {
                        const effectiveBatch =
                          OperationsService.getEffectiveBatchName(
                            ticket,
                            shifts,
                          );
                        return (
                          <tr key={ticket.id} className="col-table-row">
                            <td>
                              <span className="col-id-badge">#{ticket.id}</span>
                            </td>
                            <td>
                              <div className="col-batch-cell">
                                <span className="col-batch-name">
                                  {effectiveBatch}
                                </span>
                              </div>
                            </td>
                            <td className="col-td-time">
                              {formatTime(ticket.issued_at)}
                            </td>
                            <td>
                              {ticket.vehicle?.plate_number ? (
                                <span className="col-plate">
                                  {ticket.vehicle.plate_number}
                                </span>
                              ) : (
                                <span className="col-na">N/A</span>
                              )}
                            </td>
                            <td className="col-td-name">
                              {ticket.driver?.name || (
                                <span className="col-na">N/A</span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="col-action-btn"
                                onClick={() => handleVerifyTicket(ticket.id)}
                                disabled={verifyingTicketId === ticket.id}
                              >
                                {verifyingTicketId === ticket.id
                                  ? "Verifying…"
                                  : "Verify"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {isScheduleModalOpen && (
        <div
          className="col-sched-overlay"
          onClick={() => setIsScheduleModalOpen(false)}
        >
          <div className="col-sched-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="col-sched-modal-header">
              <div className="col-sched-modal-header-left">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c9a84c"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h2 className="col-sched-modal-title">Edit Batch Schedule</h2>
              </div>
              <button
                type="button"
                className="col-sched-modal-close"
                onClick={() => setIsScheduleModalOpen(false)}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="col-sched-modal-body">
              {Object.entries(editingShifts).map(([key, shift], idx, arr) => (
                <div
                  key={key}
                  className={`col-sched-batch-block${idx < arr.length - 1 ? " col-sched-batch-block--bordered" : ""}`}
                >
                  {/* Current schedule display — mirrors ticket-price-current */}
                  <div className="col-sched-batch-label-row">
                    <span className="col-sched-batch-name">{shift.name}</span>
                    <span className="col-sched-batch-preview">
                      {shift.label}
                    </span>
                  </div>

                  {/* Start & End hour inputs side-by-side */}
                  <div className="col-sched-hours-row">
                    <div className="col-sched-field">
                      <label className="col-sched-label">Start Hour</label>
                      <div className="col-sched-input-wrap">
                        <span className="col-sched-input-prefix">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12" />
                          </svg>
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          className="col-sched-input"
                          value={shift.startHour}
                          onChange={(e) =>
                            handleScheduleFieldChange(
                              key,
                              "startHour",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="col-sched-hours-divider">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        opacity="0.4"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>

                    <div className="col-sched-field">
                      <label className="col-sched-label">End Hour</label>
                      <div className="col-sched-input-wrap">
                        <span className="col-sched-input-prefix">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 12 16 14" />
                          </svg>
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          className="col-sched-input"
                          value={shift.endHour}
                          onChange={(e) =>
                            handleScheduleFieldChange(
                              key,
                              "endHour",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <p className="col-sched-note">
                Changes take effect immediately after saving. Tickets already
                issued retain their original batch assignment.
              </p>
            </div>

            {/* Footer */}
            <div className="col-sched-modal-footer">
              <button
                type="button"
                className="col-sched-modal-btn col-sched-modal-btn--cancel"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="col-sched-modal-btn col-sched-modal-btn--submit"
                onClick={handleSaveSchedule}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Collection;
