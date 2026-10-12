import React from "react";

/** Section title + description on the left, primary action on the right. */
function SectionHeader({ title, description, action }) {
  return (
    <div className="ui-section-header">
      <div className="ui-section-heading">
        <h2 className="ui-section-title">{title}</h2>
        {description && <p className="ui-section-desc">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
