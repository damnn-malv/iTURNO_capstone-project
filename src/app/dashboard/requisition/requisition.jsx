import React, { useState } from "react";
import { useRequisition } from "../../../lib/requisition/useRequisition";
import RequisitionFormModal from "../../../lib/requisition/RequisitionFormModal";
import "../../../styles/requisition.css";

function Requisition() {
  const {
    requisitions,
    ticketForms,
    loading,
    error,
    saving,
    showForm,
    setShowForm,
    seriesItems,
    updateSeriesItem,
    addSeriesItem,
    removeSeriesItem,
    computeTotal,
    handleSave,
    allSeries,
    inventory,
  } = useRequisition();

  const [denomFilter, setDenomFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const denomOptions = Object.keys(inventory.byDenomination);

  const filteredStock =
    denomFilter === "ALL"
      ? inventory.allStock
      : inventory.byDenomination[denomFilter]?.series || [];

  const filteredSummary =
    denomFilter === "ALL"
      ? { totalQty: inventory.totalStock, totalValue: inventory.totalValue }
      : inventory.byDenomination[denomFilter] || { totalQty: 0, totalValue: 0 };

  return (
    <div className="req-page">
      {/* Header */}
      <div className="req-header">
        <div className="req-header-left">
          <div className="req-header-accent" />
          <div>
            <h1 className="req-title">Requisition & Issue Voucher</h1>
            <p className="req-subtitle">
              Ticket inventory ledger — stock receipts and availability
            </p>
          </div>
        </div>
        <button
          type="button"
          className="req-new-btn"
          onClick={() => setShowForm(true)}
        >
          + New Requisition
        </button>
      </div>

      {/* Error */}
      {error && <div className="req-error">{error}</div>}

      {/* Modal */}
      <RequisitionFormModal
        showForm={showForm}
        setShowForm={setShowForm}
        seriesItems={seriesItems}
        updateSeriesItem={updateSeriesItem}
        addSeriesItem={addSeriesItem}
        removeSeriesItem={removeSeriesItem}
        ticketForms={ticketForms}
        computeTotal={computeTotal}
        handleSave={handleSave}
        saving={saving}
      />

      {/* Loading */}
      {loading ? (
        <div className="req-loading">Loading requisitions…</div>
      ) : (
        <>
          {/* Inventory Summary Cards */}
          <div className="req-inventory-grid">
            <div className={`req-inv-card ${inventory.hasStock ? "req-inv-card--ok" : "req-inv-card--empty"}`}>
              <span className="req-inv-card-label">Total Stock</span>
              <span className="req-inv-card-value">
                {inventory.totalStock.toLocaleString()} tickets
              </span>
              <span className="req-inv-card-sub">
                ₱{inventory.totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="req-inv-card">
              <span className="req-inv-card-label">Active Series</span>
              {inventory.activeSeries ? (
                <>
                  <span className="req-inv-card-value">{inventory.activeSeries.series_no}</span>
                  <span className="req-inv-card-sub">
                    {inventory.activeSeries.ticket_form_label || "—"} · {inventory.activeSeries.pcs.toLocaleString()} pcs
                  </span>
                </>
              ) : (
                <span className="req-inv-card-value req-inv-card-value--none">No active series</span>
              )}
            </div>
            {denomOptions.map((denom) => {
              const d = inventory.byDenomination[denom];
              return (
                <div
                  key={denom}
                  className={`req-inv-card ${d.totalQty > 0 ? "req-inv-card--ok" : "req-inv-card--empty"}`}
                >
                  <span className="req-inv-card-label">{denom}</span>
                  <span className="req-inv-card-value">
                    {d.totalQty.toLocaleString()} pcs
                  </span>
                  <span className="req-inv-card-sub">
                    {d.totalQty > 0
                      ? `₱${d.totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })} · ${d.series.length} series`
                      : "Out of stock"}
                  </span>
                </div>
              );
            })}
            {inventory.stockLevel !== "normal" && (
              <div className={`req-inv-card ${inventory.stockLevel === "low" ? "req-inv-card--alert" : "req-inv-card--ok"}`}>
                <span className="req-inv-card-label">Stock Alert</span>
                {inventory.stockLevel === "low" ? (
                  <>
                    <span className="req-inv-card-value req-inv-card-value--warn">
                      {inventory.hasStock ? "LOW STOCK" : "OUT OF STOCK"}
                    </span>
                    <span className="req-inv-card-sub">
                      {inventory.hasStock
                        ? `Only ${inventory.totalStock.toLocaleString()} tickets remaining — below 5,000 threshold`
                        : "New requisition required to resume transactions"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="req-inv-card-value req-inv-card-value--high">HIGH STOCK</span>
                    <span className="req-inv-card-sub">
                      {inventory.totalStock.toLocaleString()} tickets — above 50,000 threshold
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Ticket Stock Ledger */}
          <div className="req-table-wrap">
            <div className="req-ledger-header">
              <h3 className="req-section-heading">Ticket Stock (Oldest First)</h3>
              <div className="req-filter-wrap">
                <select
                  className="req-filter-select"
                  value={denomFilter}
                  onChange={(e) => setDenomFilter(e.target.value)}
                >
                  <option value="ALL">All Ticket Forms</option>
                  {denomOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredStock.length > 0 ? (
              <>
                <table className="req-table">
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Series No.</th>
                      <th>Ticket Form</th>
                      <th>Pad / Box</th>
                      <th>QTY (Pad/Box)</th>
                      <th>Pieces</th>
                      <th className="text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((ts, idx) => (
                      <tr key={ts.id} className={idx === 0 ? "req-row--active" : ""}>
                        <td>
                          {idx === 0 ? (
                            <span className="req-priority req-priority--current">Selling</span>
                          ) : (
                            <span className="req-priority req-priority--queued">#{idx + 1}</span>
                          )}
                        </td>
                        <td>{ts.series_no}</td>
                        <td>{ts.ticket_form_label || "—"}</td>
                        <td>{ts.pad_no || "—"} / {ts.box_no || "—"}</td>
                        <td>{ts.qty}</td>
                        <td>{ts.pcs.toLocaleString()}</td>
                        <td className="text-right">
                          ₱{parseFloat(ts.total_value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="req-table-footer">
                      <td colSpan={5} className="text-right">Total</td>
                      <td>{filteredSummary.totalQty.toLocaleString()}</td>
                      <td className="text-right">
                        ₱{filteredSummary.totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            ) : (
              <div className="req-empty" style={{ padding: "30px 20px" }}>
                <p className="req-empty-title">
                  {denomFilter === "ALL" ? "No ticket stock" : `No ${denomFilter} tickets in stock`}
                </p>
                <p className="req-empty-text">Click "+ New Requisition" to add stock</p>
              </div>
            )}
          </div>

          {/* Requisition Receipts */}
          {requisitions.length > 0 && (
            <div className="req-table-wrap">
              <h3 className="req-section-heading">Stocking Receipts</h3>
              <table className="req-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Requested By</th>
                    <th>Series Count</th>
                    <th className="text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((req) => (
                    <React.Fragment key={req.id}>
                      <tr
                        onClick={() => toggleExpand(req.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>#{req.id}</td>
                        <td>
                          {new Date(req.date_requested).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td>{req.requested_by_name}</td>
                        <td>{req.ticket_series?.length || 0} series</td>
                        <td className="text-right">
                          ₱{parseFloat(req.total_value).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>

                      {expandedId === req.id &&
                        req.ticket_series &&
                        req.ticket_series.length > 0 && (
                          <tr className="req-series-row">
                            <td colSpan={5}>
                              <table className="req-series-table">
                                <thead>
                                  <tr>
                                    <th>Series No.</th>
                                    <th>Ticket Form</th>
                                    <th>Pad No.</th>
                                    <th>Box No.</th>
                                    <th>QTY</th>
                                    <th>Total Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {req.ticket_series.map((ts) => (
                                    <tr key={ts.id}>
                                      <td>{ts.series_no}</td>
                                      <td>{ts.ticket_form_label || "—"}</td>
                                      <td>{ts.pad_no || "—"}</td>
                                      <td>{ts.box_no || "—"}</td>
                                      <td>{ts.qty}</td>
                                      <td>₱{parseFloat(ts.total_value).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Requisition;
