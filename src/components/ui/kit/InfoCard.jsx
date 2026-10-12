import React from "react";

/** Small explainer card: tinted icon on the left, bold title and short text on the right. tone: "neutral" | "warning" | "success" */
function InfoCard({ icon, tone = "neutral", title, children }) {
  return (
    <div className="ui-info-card">
      <span className={`ui-info-icon ui-info-icon--${tone}`}>{icon}</span>
      <div>
        <div className="ui-info-title">{title}</div>
        <p className="ui-info-text">{children}</p>
      </div>
    </div>
  );
}

export default InfoCard;
