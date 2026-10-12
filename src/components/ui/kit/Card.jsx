import React from "react";

/** Plain white card with an optional title and description. */
function Card({ title, description, children }) {
  return (
    <section className="ui-card">
      {title && <h3 className="ui-card-title">{title}</h3>}
      {description && <p className="ui-card-desc">{description}</p>}
      {children}
    </section>
  );
}

export default Card;
