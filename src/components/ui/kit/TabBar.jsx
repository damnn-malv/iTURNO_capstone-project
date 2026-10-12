import React from "react";

/** Pill tabs for switching record types inside a section. tabs: [{ key, label, count? }] */
function TabBar({ tabs, value, onChange, label = "Record type" }) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          className={`ui-tab${value === t.key ? " ui-tab--active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && <span className="ui-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export default TabBar;
