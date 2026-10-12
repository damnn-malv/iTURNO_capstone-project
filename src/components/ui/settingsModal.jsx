import React from "react";
import { ActionButton } from "./kit";

/**
 * Reusable "add item" modal for the Settings page (PUV Types, Routes, Ticket Forms, ...).
 *
 * fields: [{ name, label, type = "text", placeholder, step, min }]
 * values: { [field.name]: value }
 */
function SettingsModal({
  open,
  title,
  fields = [],
  values = {},
  onChange,
  onClose,
  onSubmit,
  saving = false,
  submitLabel = "Save",
  savingLabel = "Saving...",
}) {
  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!saving) onSubmit?.();
  };

  // Locked while saving so nobody can double-submit or close mid-request.
  const close = () => { if (!saving) onClose?.(); };

  return (
    <div className="setm-overlay" onClick={close}>
      <div className="setm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="setm-header">
          <h2 className="setm-title">{title}</h2>
          <button type="button" className="setm-close" onClick={close} disabled={saving} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="setm-body">
            {fields.map((field) => field.readOnly ? (
              <div key={field.name} className="setm-field">
                <span className="setm-field-label">{field.label}</span>
                <div className="setm-readonly">{field.display}</div>
              </div>
            ) : (
              <label key={field.name} className="setm-field">
                <span className="setm-field-label">{field.label}</span>
                <span className={field.prefix ? "setm-prefixed" : undefined}>
                  {field.prefix && <span className="setm-prefix">{field.prefix}</span>}
                  <input
                    type={field.type || "text"}
                    className="setm-input"
                    placeholder={field.placeholder}
                    step={field.step}
                    min={field.min}
                    value={values[field.name] ?? ""}
                    onChange={(e) => onChange?.(field.name, e.target.value)}
                    autoFocus={field === fields[0]}
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="setm-footer">
            <ActionButton variant="secondary" onClick={close} disabled={saving}>Cancel</ActionButton>
            <ActionButton variant="primary" type="submit" busy={saving} busyLabel={savingLabel}>{submitLabel}</ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsModal;
