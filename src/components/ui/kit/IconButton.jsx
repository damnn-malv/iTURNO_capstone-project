import React from "react";
import Spinner from "./Spinner";
import useDelayedFlag from "./useDelayedFlag";

/**
 * Square icon button. `label` is required: it is the accessible name and tooltip.
 * Pass `text` to also show a visible caption next to the icon (use it for
 * destructive or unfamiliar actions so the meaning is never icon-only).
 * While `busy` the button is disabled and, after 150 ms, shows a spinner in place of the icon.
 */
function IconButton({ icon, label, text, onClick, tone = "default", disabled = false, busy = false }) {
  const showBusy = useDelayedFlag(busy);
  return (
    <button
      type="button"
      className={`ui-icon-btn ui-icon-btn--${tone}${text ? " ui-icon-btn--text" : ""}`}
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      aria-busy={busy || undefined}
      title={label}
    >
      {showBusy ? <Spinner size={16} /> : icon}
      {text && <span className="ui-icon-btn-text">{text}</span>}
    </button>
  );
}

export default IconButton;
