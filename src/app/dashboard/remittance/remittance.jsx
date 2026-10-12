import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CreateBatchForm from "./createRemittance";
import { apiService } from "../../../lib/api-service";
import { getPhDateString } from "../../../lib/phDate";
import IssuedStatus from "./IssuedStatus";
import { useFeedback } from "../../../components/ui/kit";
import "../../../styles/Remittance.css";
import "../../../styles/Report.css";

export default function Remittance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useFeedback();

  // ?date=YYYY-MM-DD is the missed day when filing a late remittance; anything
  // malformed or not strictly in the past falls back to a normal (today) batch.
  const dateParam = searchParams.get("date");
  const targetDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateParam || "") && dateParam < getPhDateString(0)
      ? dateParam
      : null;

  const [formKey, setFormKey] = useState(0);
  const [showLatePicker, setShowLatePicker] = useState(false);
  const [latePickerDate, setLatePickerDate] = useState(getPhDateString(-1));

  // The status card follows the batch being filed: today normally, the missed day for a late one.
  const statusDate = targetDate || getPhDateString(0);
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchRef = useRef(null);
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await apiService.get(`/report/eod-reconciliation/?date=${statusDate}`);
      setStatus(data);
    } catch (err) {
      console.error("Failed to load remittance status", err);
      notify.error({
        title: "Couldn't load the remittance status",
        message: err?.message?.replace(/^Error:\s*/, "") || "Nothing was changed. Check your connection and try again.",
        onRetry: () => fetchRef.current(),
      });
    } finally {
      setStatusLoading(false);
    }
  }, [statusDate, notify]);

  useEffect(() => {
    fetchRef.current = fetchStatus;
    fetchStatus();
  }, [fetchStatus]);

  const handleConfirmLateDate = () => {
    setSearchParams({ date: latePickerDate });
    setShowLatePicker(false);
  };

  return (
    <div className="rem-page">
      <div className="rem-header">
        <div className="rem-header-left">
          <div>
            <h1 className="rem-title">{targetDate ? "Late Remittance" : "Remittance"}</h1>
          </div>
        </div>
        <div className="rem-header-right">
          {targetDate && (
            <button className="rem-add-btn rem-add-btn--secondary" onClick={() => setSearchParams({})}>
              Back to Today
            </button>
          )}
          <button
            className="rem-add-btn rem-add-btn--secondary"
            onClick={() => {
              setLatePickerDate(getPhDateString(-1));
              setShowLatePicker(true);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            File Late Remittance
          </button>
        </div>
      </div>

      {showLatePicker && (
        <div className="rem-alert rem-alert--info">
          <span>File a late remittance covering which day?</span>
          <input
            type="date"
            className="rem-input"
            value={latePickerDate}
            max={getPhDateString(-1)}
            onChange={(e) => setLatePickerDate(e.target.value)}
          />
          <button className="rem-btn rem-btn--view" onClick={handleConfirmLateDate}>Continue</button>
          <button className="rem-btn rem-btn--delete" onClick={() => setShowLatePicker(false)}>Cancel</button>
        </div>
      )}

      <IssuedStatus
        date={statusDate}
        isLate={!!targetDate}
        data={status}
        loading={statusLoading}
      />

      <CreateBatchForm
        key={`${targetDate || "today"}-${formKey}`}
        targetDate={targetDate}
        onSaved={() => {
          // Remount for a fresh form (re-fetches batches, tickets and series)
          // and refresh the status card; a saved late batch returns to today's form.
          setSearchParams({});
          setFormKey((k) => k + 1);
          fetchStatus();
        }}
      />
    </div>
  );
}
