import React from "react";
import { SortIcon } from "./icons";

/** options: [{ value, label }] */
function SortSelect({ value, onChange, options, label = "Sort" }) {
  return (
    <label className="ui-sort">
      <span className="ui-sort-icon"><SortIcon /></span>
      <select className="ui-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export default SortSelect;
