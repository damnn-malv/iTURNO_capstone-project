import React, { useCallback, useEffect, useState } from "react";
import { apiService } from "../../../lib/api-service";
import { getPhDateString } from "../../../lib/phDate";
import { useToast, useConfirm } from "../../../components/ui/ToastConfirmContext";
import "../../../styles/FormModal.css";

const REASONS = [
  ["SYSTEM_DOWN", "System down"],
  ["REMITTED_WITHOUT_SYSTEM", "Remitted without system"],
  ["OTHER", "Other"],
];

const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Records physical tickets handed out outside the system. Both ends are editable
// (the paper stub may come from an older series, or out of order); the server
// rejects overlaps with system-issued tickets or earlier paper ranges.
export default function PaperRangeModal({ series, onClose, onSaved }) {
  const showToast = useToast();
  const showConfirm = useConfirm();
  const [ranges, setRanges] = useState([]);
  const [form, setForm] = useState({ from_no: "", to_no: "", used_on: getPhDateString(), reason: "SYSTEM_DOWN", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setRanges(await apiService.request(`/paper-issuances/?series=${series.id}`));
      // Start defaults to the next free number so only the last number is typed.
      const { next_free } = await apiService.request(`/paper-issuances/next-free/?series=${series.id}`);
      setForm((f) => ({ ...f, from_no: next_free ?? "" }));
    } catch {
      // list is informational; the form still works
    }
  }, [series.id]);

  useEffect(() => { load(); }, [load]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const from = parseInt(form.from_no, 10);
  const to = parseInt(form.to_no, 10);
  const count = from > 0 && to >= from ? to - from + 1 : 0;
  const price = parseFloat(series.ticket_form_price) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiService.request("/paper-issuances/", {
        method: "POST",
        body: JSON.stringify({ ...form, series: series.id, from_no: from, to_no: to }),
      });
      showToast(`${count.toLocaleString()} paper ticket(s) recorded`);
      setForm((f) => ({ ...f, to_no: "", note: "" }));
      await load();
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to record range");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!(await showConfirm(`Remove paper range ${r.from_no}–${r.to_no}? Those numbers become available to the system again.`))) return;
    try {
      await apiService.request(`/paper-issuances/${r.id}/`, { method: "DELETE" });
      await load();
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to remove range");
    }
  };

  return (
    <div className="usr-overlay" onClick={onClose}>
      <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="usr-modal-header">
          <h2 className="usr-modal-title">Paper-issued tickets — Series {series.series_no}</h2>
          <button type="button" className="usr-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="usr-modal-body" onSubmit={submit}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>
            For tickets handed out outside the system. These numbers are skipped by the system and counted in stock.
            Their cash was remitted at the treasury, so it is not added to the day's cash to remit — record one range
            per day. Series range: {series.start_no}–{series.end_no}.
          </p>

          <div className="usr-form-grid">
            <div className="usr-field">
              <label className="usr-label">From No. (next free)</label>
              <input className="usr-input" type="number" min={series.start_no} max={series.end_no} required
                value={form.from_no} onChange={set("from_no")} />
            </div>
            <div className="usr-field">
              <label className="usr-label">Last number used</label>
              <input className="usr-input" type="number" min={series.start_no} max={series.end_no} required
                value={form.to_no} onChange={set("to_no")} />
            </div>
            <div className="usr-field">
              <label className="usr-label">Date used</label>
              <input className="usr-input" type="date" required value={form.used_on} onChange={set("used_on")} />
            </div>
            <div className="usr-field">
              <label className="usr-label">Reason</label>
              <select className="usr-select" value={form.reason} onChange={set("reason")}>
                {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="usr-field" style={{ gridColumn: "1 / -1" }}>
              <label className="usr-label">Note (optional)</label>
              <input className="usr-input" maxLength={255} value={form.note} onChange={set("note")} />
            </div>
          </div>

          {count > 0 && (
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {count.toLocaleString()} ticket(s) · {peso(count * price)}
            </div>
          )}
          {error && <div className="req-modal-error" role="alert">{error}</div>}

          {ranges.length > 0 && (
            <table className="req-series-table">
              <thead>
                <tr><th>Range</th><th>Date</th><th className="text-right">Qty</th><th className="text-right">Amount</th><th /></tr>
              </thead>
              <tbody>
                {ranges.map((r) => (
                  <tr key={r.id}>
                    <td>{r.from_no}–{r.to_no}</td>
                    <td>{r.used_on}</td>
                    <td className="text-right">{r.count.toLocaleString()}</td>
                    <td className="text-right">{peso(r.amount)}</td>
                    <td className="text-right">
                      {r.remittance_batch
                        ? <span style={{ color: "var(--text-secondary)" }}>Remitted</span>
                        : <button type="button" className="usr-modal-btn usr-modal-btn--cancel" style={{ padding: "3px 10px" }} onClick={() => remove(r)}>Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="usr-modal-footer">
            <button type="button" className="usr-modal-btn usr-modal-btn--cancel" onClick={onClose}>Close</button>
            <button type="submit" className="usr-modal-btn usr-modal-btn--submit" disabled={saving || count === 0}>
              {saving ? "Saving…" : "Record range"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
