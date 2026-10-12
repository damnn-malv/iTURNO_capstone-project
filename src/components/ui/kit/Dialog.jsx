import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";

/**
 * Modal dialog, centered or as a right-hand drawer.
 *
 * placement: "center" | "drawer"
 * icon:      optional round icon above the title (center placement)
 * footer:    buttons, rendered in a tinted bar at the bottom
 * size:      "sm" for short confirmations
 * busy:      blocks closing (Esc, backdrop, X) while an action is running
 */
function Dialog({ open, onClose, title, subtitle, icon, placement = "center", size, busy = false, footer, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={`ui-overlay ui-overlay--${placement}`} onMouseDown={() => { if (!busy) onClose(); }}>
      <div
        className={`ui-dialog ui-dialog--${placement}${size === "sm" ? " ui-dialog--sm" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {placement === "drawer" ? (
          <div className="ui-dialog-head">
            <div>
              <h2 className="ui-dialog-title">{title}</h2>
              {subtitle && <p className="ui-dialog-sub">{subtitle}</p>}
            </div>
            <button type="button" className="ui-dialog-x" onClick={onClose} disabled={busy} aria-label="Close">
              <CloseIcon size={18} />
            </button>
          </div>
        ) : (
          <div className="ui-dialog-head ui-dialog-head--stack">
            {icon && <span className="ui-dialog-icon">{icon}</span>}
            <h2 className="ui-dialog-title">{title}</h2>
            {subtitle && <p className="ui-dialog-sub">{subtitle}</p>}
          </div>
        )}
        <div className="ui-dialog-body">{children}</div>
        {footer && <div className="ui-dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export default Dialog;
