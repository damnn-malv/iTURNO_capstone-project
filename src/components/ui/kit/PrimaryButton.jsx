import React from "react";
import { PlusIcon } from "./icons";
import ActionButton from "./ActionButton";

function PrimaryButton({ children, onClick, icon = <PlusIcon />, busy, busyLabel }) {
  return (
    <ActionButton variant="primary" onClick={onClick} icon={icon} busy={busy} busyLabel={busyLabel}>
      {children}
    </ActionButton>
  );
}

export default PrimaryButton;
