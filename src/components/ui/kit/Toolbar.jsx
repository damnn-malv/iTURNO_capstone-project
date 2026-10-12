import React from "react";

/** Row of controls above a table. Put a SearchInput first; it takes the free space. */
function Toolbar({ children }) {
  return <div className="ui-toolbar">{children}</div>;
}

export default Toolbar;
