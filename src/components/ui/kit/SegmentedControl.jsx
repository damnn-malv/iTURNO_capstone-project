import React from "react";

/** Compact filter switch that lives inside a toolbar. options: [{ key, label, count? }] */
function SegmentedControl({ options, value, onChange, label = "Filter" }) {
  return (
    <div className="ui-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`ui-seg-btn${value === o.key ? " ui-seg-btn--active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}{o.count != null && ` \u00b7 ${o.count}`}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;
