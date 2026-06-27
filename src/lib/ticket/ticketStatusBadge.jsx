import React, { useState } from "react";
import { CancelIcon } from "./ticketIcon";

const statusColor = {
  CANCELLED: "ticket-status--cancelled",
  DISPATCHED: "ticket-status--dispatched",
  COLLECTED: "ticket-status--collected",
};

export default function TicketStatusBadge({ ticket }) {
  const [reasonOpen, setReasonOpen] = useState(false);

  return (
    <>
      <div className="ticket-status-cell">
        <span className={`ticket-status ${statusColor[ticket.status] || "ticket-status--default"}`}>
          {ticket.status}
        </span>

        {ticket.status === "CANCELLED" && ticket.reason && (
          <span
            className="ticket-cancel-tag"
            onClick={() => setReasonOpen(true)}
          >
            <CancelIcon />
          </span>
        )}
      </div>

      {reasonOpen && (
        <div className="ticket-reason-overlay" onClick={() => setReasonOpen(false)}>
          <div className="ticket-reason-modal" onClick={(e) => e.stopPropagation()}>

            <div className="ticket-reason-modal-header">
              <div className="ticket-reason-modal-header-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2.2">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                <span className="ticket-reason-modal-title">Cancellation Reason</span>
              </div>
              <button className="ticket-reason-modal-close" onClick={() => setReasonOpen(false)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="ticket-reason-modal-body">
              <div className="ticket-reason-meta">
                <span className="ticket-reason-meta-label">Ticket</span>
                <span className="ticket-reason-meta-id">#{ticket.id}</span>
                <span className="ticket-status ticket-status--cancelled" style={{ fontSize: "10px", padding: "2px 8px" }}>
                  CANCELLED
                </span>
              </div>
              <p className="ticket-reason-text">{ticket.reason}</p>
            </div>

            

          </div>
        </div>
      )}
    </>
  );
}
