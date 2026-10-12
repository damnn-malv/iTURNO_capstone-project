import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ClockIcon } from "./kit";

const AUTO_CLOSE_MS = 5000;

const formatWhen = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
};

/**
 * Centered welcome card shown once after sign in. Closes by itself after 5 s
 * (the bar at the bottom shows the time left), or sooner with the button, Esc
 * or a click outside the card.
 *
 * lastSignIn is the previous sign-in on this browser; leave it out when there is none.
 */
function WelcomeCard({ name, role, lastSignIn, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const when = lastSignIn ? formatWhen(lastSignIn) : null;

  return createPortal(
    <div className="ui-overlay ui-overlay--center ui-overlay--welcome" onMouseDown={onClose}>
      <div className="ui-welcome" role="dialog" aria-modal="true" aria-label="Welcome" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="ui-welcome-greeting">Welcome back,</h2>
        <p className="ui-welcome-name">{name}</p>
        {role && <span className="ui-welcome-role">{role}</span>}

        {when && (
          <div className="ui-welcome-last">
            <ClockIcon />
            <span>Last signed in <strong>{when}</strong></span>
          </div>
        )}

        <button type="button" className="ui-primary-btn ui-welcome-btn" onClick={onClose} autoFocus>
          Go to dashboard
        </button>

        <span className="ui-note-bar" style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }} onAnimationEnd={onClose} />
      </div>
    </div>,
    document.body,
  );
}

export default WelcomeCard;
