import React from "react";
import Spinner from "./Spinner";
import useDelayedFlag from "./useDelayedFlag";

/**
 * Label for any button that can be "working". Both the idle and the working
 * label are laid out in one grid cell, so the button never changes width.
 * The spinner appears only after 150 ms, so instant actions don't flash.
 */
function ButtonLabel({ busy = false, busyLabel, icon, children }) {
  const showBusy = useDelayedFlag(busy);
  return (
    <span className="ui-btn-label">
      <span className={showBusy ? "ui-btn-label-hidden" : undefined}>{icon}{children}</span>
      <span className={showBusy ? "ui-btn-label-busy" : "ui-btn-label-busy ui-btn-label-hidden"} aria-hidden={!showBusy}>
        <Spinner />
        {busyLabel || children}
      </span>
    </span>
  );
}

export default ButtonLabel;
