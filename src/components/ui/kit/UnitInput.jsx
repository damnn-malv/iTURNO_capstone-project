import React from "react";

/** Number input with an optional fixed prefix (e.g. ₱) and/or suffix (e.g. min). */
function UnitInput({ prefix, suffix, value, onChange, label, min = 0, step, placeholder }) {
  return (
    <span className="ui-fee-input">
      {prefix && <span className="ui-fee-prefix">{prefix}</span>}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      {suffix && <span className="ui-fee-suffix">{suffix}</span>}
    </span>
  );
}

export default UnitInput;
