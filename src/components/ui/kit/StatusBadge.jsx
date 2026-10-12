import React from "react";

/** tone: "success" | "info" | "warning" | "danger" | "neutral". Pass dot={false} for a plain pill. */
function StatusBadge({ tone = "neutral", dot = true, children }) {
  return (
    <span className={`ui-badge ui-badge--${tone}`}>
      {dot && <span className="ui-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default StatusBadge;
