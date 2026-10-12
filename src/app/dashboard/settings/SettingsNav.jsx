import React from "react";
import { NavLink } from "react-router-dom";
import { SETTINGS_SECTIONS, SETTINGS_BASE, canViewSection } from "./settingsSections";

function SettingsNav({ role, counts = {} }) {
  const visible = SETTINGS_SECTIONS.filter((s) => canViewSection(s, role));
  const groups = [...new Set(visible.map((s) => s.group))];

  return (
    <nav className="set-nav" aria-label="Settings sections">
      {groups.map((group) => (
        <div className="set-nav-group" key={group}>
          <div className="set-nav-group-label">{group}</div>
          {visible
            .filter((s) => s.group === group)
            .map((s) => (
              <NavLink
                key={s.key}
                to={`${SETTINGS_BASE}/${s.key}`}
                className={({ isActive }) => (isActive ? "set-nav-item set-nav-item-active" : "set-nav-item")}
              >
                <span>{s.label}</span>
                {counts[s.key] != null && <span className="set-nav-count">{counts[s.key]}</span>}
              </NavLink>
            ))}
        </div>
      ))}
    </nav>
  );
}

export default SettingsNav;
