import React from "react";
import { createPortal } from "react-dom";
import Spinner from "./Spinner";

/** Blocks the whole page with a spinner card, for actions that leave the page (sign in, sign out). */
function BusyOverlay({ open, title, hint }) {
  if (!open) return null;
  return createPortal(
    <div className="ui-overlay ui-overlay--center ui-overlay--busy" role="alertdialog" aria-modal="true" aria-live="polite" aria-busy="true" aria-label={title}>
      <div className="ui-busy-card">
        <Spinner size={28} />
        <div>
          <div className="ui-busy-title">{title}</div>
          {hint && <div className="ui-busy-hint">{hint}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default BusyOverlay;
