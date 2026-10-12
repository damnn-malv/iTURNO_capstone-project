import React from "react";
import { createPortal } from "react-dom";
import Spinner from "./Spinner";
import { CheckIcon } from "./icons";

/**
 * Blocking dialog for long operations (backup, restore, roll back).
 * It cannot be closed: it stays until the caller unmounts it.
 *
 * steps:  [{ label, doneLabel? }]; `doneLabel` is shown once the step is finished
 * active: index of the step that is running; earlier steps are done
 */
function ProgressDialog({ open, title, hint = "Please keep this page open.", steps, active }) {
  if (!open) return null;
  const pct = Math.min(95, ((active + 0.5) / steps.length) * 100);

  return createPortal(
    <div className="ui-overlay ui-overlay--center">
      <div className="ui-dialog ui-dialog--center ui-dialog--progress" role="alertdialog" aria-modal="true" aria-label={title} aria-live="polite">
        <div className="ui-dialog-head ui-dialog-head--stack">
          <h2 className="ui-dialog-title">{title}</h2>
          <p className="ui-dialog-sub">{hint}</p>
        </div>
        <div className="ui-dialog-body">
          <div className="ui-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <span className="ui-progress-fill" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <ul className="ui-progress-steps">
            {steps.map((s, i) => {
              const state = i < active ? "done" : i === active ? "active" : "todo";
              return (
                <li key={s.label} className={`ui-pstep ui-pstep--${state}`}>
                  <span className="ui-pstep-mark">
                    {state === "done" && <CheckIcon size={12} />}
                    {state === "active" && <Spinner size={16} />}
                  </span>
                  {state === "done" && s.doneLabel ? s.doneLabel : s.label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ProgressDialog;
