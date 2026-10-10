import React, { useState } from "react";
import { useRequisition } from "./useRequisition";
import RequisitionFormModal from "./RequisitionFormModal";
import PaperRangeModal from "./PaperRangeModal";
import { IS_REMOTE } from "../../../lib/api-service";
import "../../../styles/requisition.css";

function formatCurrency(val) {
  return "₱" + Number(val || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function Requisition() {
  const {
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
    approvedBy,
    setApprovedBy,
    refresh,
  } = useRequisition();

  const [expandedDenom, setExpandedDenom] = useState(null);
  const [paperSeries, setPaperSeries] = useState(null);

  const toggleDenom = (denom) =>
    setExpandedDenom((prev) => (prev === denom ? null : denom));

  const denomOptions = Object.keys(inventory.byDenomination);

  return (
    <div className="req-page">
      {/* Header */}
      <div className="req-header">
        <div className="req-header-left">
          <div className="req-header-accent" />
          <div>
            <h1 className="req-title">Requisition & Issue Voucher</h1>
            
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
      {error && !showForm && <div className="req-error">{error}</div>}

      {/* Modal */}
      <RequisitionFormModal
        showForm={showForm}
        setShowForm={setShowForm}
        seriesItems={seriesItems}
        updateSeriesItem={updateSeriesItem}
        addSeriesItem={addSeriesItem}
        removeSeriesItem={removeSeriesItem}
        ticketForms={ticketForms}
        approvedBy={approvedBy}
        setApprovedBy={setApprovedBy}
        computeTotal={computeTotal}
        handleSave={handleSave}
        saving={saving}
        error={error}
      />

      {paperSeries && (
        <PaperRangeModal series={paperSeries} onClose={() => setPaperSeries(null)} onSaved={refresh} />
      )}

      {/* Loading */}
      {loading ? (
        <div className="req-loading">Loading requisitions…</div>
      ) : (
        <>
          {/* Collections & Deposits by Denomination */}
          <div className="req-table-wrap">
            <div className="req-report-section-header">
              <h3 className="req-report-section-label">COLLECTIONS & DEPOSITS</h3>
            </div>
            <table className="req-table">
              <thead>
                <tr>
                  <th>Den.</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {denomOptions.length > 0 ? (
                  denomOptions.map((denom) => {
                    const d = inventory.byDenomination[denom];
                    const isExpanded = expandedDenom === denom;
                    return (
                      <React.Fragment key={denom}>
                        <tr
                          onClick={() => toggleDenom(denom)}
                          className={`req-row--clickable ${isExpanded ? "req-row--active" : ""}`}
                        >
                          <td>
                            <span className={`req-expand-icon ${isExpanded ? "req-expand-icon--open" : ""}`}>&#9654;</span>
                            {denom}
                            <span className="req-expand-hint">{isExpanded ? "Hide series" : "View series"}</span>
                          </td>
                          <td className="text-right">{d.totalQty.toLocaleString()}</td>
                          <td className="text-right">{formatCurrency(d.totalValue)}</td>
                        </tr>
                        {isExpanded && d.series.length > 0 && (
                          <tr className="req-series-row">
                            <td colSpan={3}>
                              <table className="req-series-table">
                                <thead>
                                  <tr>
                                    <th>Series No.</th>
                                    <th>Date Created</th>
                                    <th className="text-right">Beginning</th>
                                    <th className="text-right">Remaining</th>
                                    <th className="text-right">Amount</th>
                                    {!IS_REMOTE && <th className="text-right">Action</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {d.series.filter((ts) => ts.remaining > 0).map((ts) => (
                                      <tr key={ts.id}>
                                        <td>
                                          {ts.series_no || "—"}{" "}
                                          <span style={{ color: "var(--text-secondary)" }}>
                                            ({ts.last_used_no != null ? `ended ${ts.last_used_no}` : "none used"})
                                          </span>
                                        </td>
                                        <td>{formatDate(ts.created_at)}</td>
                                        <td className="text-right">{(ts.beginning ?? ts.pcs ?? 0).toLocaleString()}</td>
                                        <td className="text-right">{(ts.remaining ?? ts.pcs ?? 0).toLocaleString()}</td>
                                        <td className="text-right">{formatCurrency(ts.current_value)}</td>
                                        {!IS_REMOTE && (
                                          <td className="text-right">
                                            <button type="button" className="req-new-btn" style={{ padding: "3px 10px", fontSize: 11 }}
                                              onClick={() => setPaperSeries(ts)}>
                                              Paper range
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "30px 16px" }}>
                      No ticket stock — click "+ New Requisition" to add stock
                    </td>
                  </tr>
                )}
              </tbody>
              {denomOptions.length > 0 && (
                <tfoot>
                  <tr className="req-table-footer">
                    <td><strong>TOTAL</strong></td>
                    <td className="text-right">
                      <strong>{inventory.totalStock.toLocaleString()}</strong>
                    </td>
                    <td className="text-right">
                      <strong>{formatCurrency(inventory.totalValue)}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default Requisition;
