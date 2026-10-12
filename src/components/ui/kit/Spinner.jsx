import React from "react";

/** Small rotating arc. Inherits the text color, so it works on any button or row. */
function Spinner({ size = 14 }) {
  return (
    <svg className="ui-spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default Spinner;
