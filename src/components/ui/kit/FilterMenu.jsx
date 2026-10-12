import React, { useEffect, useRef, useState } from "react";
import { FilterIcon } from "./icons";

/**
 * "Filters" button with a popover panel.
 *
 * Children are FilterGroups. `activeCount` drives the count pill, `onClear`
 * the "Clear" link. Filters apply live. Pass `showLabel` only if you want
 * an extra button that closes the panel.
 */
function FilterMenu({ activeCount, onClear, showLabel, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ui-filter" ref={ref}>
      <button
        type="button"
        className={`ui-filter-btn${open || activeCount > 0 ? " ui-filter-btn--active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FilterIcon />
        Filters
        {activeCount > 0 && <span className="ui-filter-count">{activeCount}</span>}
      </button>
      {open && (
        <div className="ui-filter-panel" role="dialog" aria-label="Filters">
          <div className="ui-filter-body">{children}</div>
          <div className="ui-filter-footer">
            <button type="button" className="ui-link-btn" onClick={onClear} disabled={activeCount === 0}>Clear</button>
            {showLabel && (
              <button type="button" className="ui-primary-btn ui-primary-btn--sm" onClick={() => setOpen(false)}>{showLabel}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterGroup({ title, children }) {
  return (
    <fieldset className="ui-filter-group">
      <legend className="ui-filter-group-title">{title}</legend>
      {children}
    </fieldset>
  );
}

/** type: "checkbox" | "radio" */
export function FilterOption({ type = "checkbox", name, checked, onChange, label, count }) {
  return (
    <label className="ui-filter-option">
      <input type={type} name={name} checked={checked} onChange={onChange} />
      <span className="ui-filter-option-label">{label}</span>
      {count != null && <span className="ui-filter-option-count">{count}</span>}
    </label>
  );
}

/** Removable chips for the active filters. chips: [{ key, label, onRemove }] */
export function FilterChips({ chips, onClearAll }) {
  if (chips.length === 0) return null;
  return (
    <div className="ui-chips">
      <span className="ui-chips-label">Active filters:</span>
      {chips.map((c) => (
        <span className="ui-chip" key={c.key}>
          {c.label}
          <button type="button" className="ui-chip-x" onClick={c.onRemove} aria-label={`Remove filter ${c.label}`}>
            <span aria-hidden="true">&times;</span>
          </button>
        </span>
      ))}
      <button type="button" className="ui-link-btn" onClick={onClearAll}>Clear</button>
    </div>
  );
}

export default FilterMenu;
