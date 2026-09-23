import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import Dispatch from "./dispatch/dispatch";
import Requisition from "./requisition/requisition"
import Queue from "./queue/queue";
import Collections from "./collection/collection";
import Remittance from "./remittance/remittance"
import Registry from "./registry/registry";
import StaffRegistry from "./user/user";
import Reports from "./report/report";
import Settings from "./settings/settings"
import {
  CollectionsIcon,
  DashboardIcon,
  DispatchIcon,
  RemittanceIcon,
  ReportIcon,
  RequisitionIcon,
  SettingsIcon,
  QueueIcon,
  UserIcon,
  VehicleIcon,
} from "../../components/ui/NavIcon";
import { apiService } from "../../lib/api-service";
import { useToast, useConfirm } from "../../components/ui/ToastConfirmContext";
import ForcePasswordChange from "../../components/auth/ForcePasswordChange";
import GlobalNotices from "../../components/notices/GlobalNotices";
import "./../../styles/mainIndex.css";
import sfcLogo from "../../pictures/sfc-nobg-logo.png";

const NAV_GROUPS = [
  [{ to: "/dashboard", label: "Dashboard", Icon: DashboardIcon }],
  [
    { to: "/dashboard/Requisition", label: "Ticket Requisition", Icon: RequisitionIcon },
    { to: "/dashboard/Remittance", label: "Remittance", Icon: RemittanceIcon },
  ],
  [
    { to: "/dashboard/Queue", label: "Queue Management", Icon: QueueIcon },
    { to: "/dashboard/Dispatch", label: "Dispatch", Icon: DispatchIcon },
    { to: "/dashboard/Collections", label: "Transaction", Icon: CollectionsIcon },
  ],
  [
    { to: "/dashboard/Registry", label: "Fleet & Driver", Icon: VehicleIcon },
    { to: "/dashboard/StaffRegistry", label: "User Management", Icon: UserIcon },
  ],
  [{ to: "/dashboard/Reports", label: "Reports", Icon: ReportIcon }],
  [{ to: "/dashboard/Settings", label: "Settings", Icon: SettingsIcon }],
];

// Scan FAB drag-to-reposition (Assistive-Touch / Messenger-chat-head style —
// see mainIndex() below for why a fixed corner isn't enough on its own).
const FAB_SIZE = 52;
const FAB_MARGIN = 16;
const FAB_TOP_MIN = 64; // clears the 56px mobile header
const FAB_POS_KEY = "mobileScanFabPos";

function clampFabPos({ x, y }) {
  const maxX = window.innerWidth - FAB_SIZE - FAB_MARGIN;
  const maxY = window.innerHeight - FAB_SIZE - FAB_MARGIN;
  return {
    x: Math.min(Math.max(x, FAB_MARGIN), Math.max(maxX, FAB_MARGIN)),
    y: Math.min(Math.max(y, FAB_TOP_MIN), Math.max(maxY, FAB_TOP_MIN)),
  };
}

const ROLE_LABELS = {
  SUPERADMIN: "Admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  PERSONNEL: "Personnel",
};

const ROLE_NAV = {
  SUPERADMIN: [
    "/dashboard",
    "/dashboard/Requisition",
    "/dashboard/Queue",
    "/dashboard/Dispatch",
    "/dashboard/Collections",
    "/dashboard/Remittance",
    "/dashboard/Registry",
    "/dashboard/StaffRegistry",
    "/dashboard/Reports",
    "/dashboard/Settings",
  ],
  MANAGER: [
    "/dashboard",
    "/dashboard/Collections",
    "/dashboard/Registry",
    "/dashboard/StaffRegistry",
    "/dashboard/Reports",
    "/dashboard/Settings",
  ],
  SUPERVISOR: [
    "/dashboard",
    "/dashboard/Requisition",
    "/dashboard/Queue",
    "/dashboard/Dispatch",
    "/dashboard/Collections",
    "/dashboard/Remittance",
    "/dashboard/Registry",
    "/dashboard/Reports",
    "/dashboard/Settings",
  ],
  PERSONNEL: [
    "/dashboard",
    "/dashboard/Queue",
    "/dashboard/Dispatch",
    "/dashboard/Reports",
  ],
};

function mainIndex() {
  const [currentUser, setCurrentUser] = useState({});
  const [userLoaded, setUserLoaded] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const showToast = useToast();
  const showConfirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Scan FAB dims itself while the page is being scrolled (same idea as
  // Gmail/Twitter's mobile compose button) so it doesn't sit at full
  // opacity over content the user is actively reading, then fades back in
  // once scrolling settles.
  const [fabDimmed, setFabDimmed] = useState(false);
  const mainContentRef = useRef(null);
  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;
    let hideTimer;
    const handleScroll = () => {
      setFabDimmed(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setFabDimmed(false), 900);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(hideTimer);
    };
  }, []);

  // A fixed corner covers whatever that page already puts there (pagination
  // "Next" buttons, save bars, etc.), so the FAB is draggable instead —
  // same idea as Android's Assistive Touch or Messenger's chat heads: the
  // user drags it out of the way once, it snaps to the nearest edge, and
  // the spot is remembered per device from then on.
  const [fabPos, setFabPos] = useState(null); // null = default CSS corner
  const [fabDragging, setFabDragging] = useState(false);
  const fabDragRef = useRef({ moved: false });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAB_POS_KEY));
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        setFabPos(clampFabPos(saved));
      }
    } catch {
      // ignore malformed/blocked storage
    }
  }, []);

  useEffect(() => {
    const onResize = () => setFabPos((pos) => (pos ? clampFabPos(pos) : pos));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleFabPointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    fabDragRef.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setFabDragging(true);
  };

  const handleFabPointerMove = (e) => {
    const drag = fabDragRef.current;
    if (!drag || e.buttons === 0) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved) {
      setFabPos(clampFabPos({ x: e.clientX - drag.offsetX, y: e.clientY - drag.offsetY }));
    }
  };

  const handleFabPointerUp = () => {
    const drag = fabDragRef.current;
    setFabDragging(false);
    if (drag.moved) {
      setFabPos((pos) => {
        if (!pos) return pos;
        const snappedX =
          pos.x + FAB_SIZE / 2 < window.innerWidth / 2
            ? FAB_MARGIN
            : window.innerWidth - FAB_SIZE - FAB_MARGIN;
        const snapped = clampFabPos({ x: snappedX, y: pos.y });
        try {
          localStorage.setItem(FAB_POS_KEY, JSON.stringify(snapped));
        } catch {
          // ignore blocked storage
        }
        return snapped;
      });
    } else {
      navigate("/mobile-scan");
    }
  };

  // dark/light
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    let isMounted = true;

    apiService
      .getCurrentUser()
      .then((user) => {
        if (isMounted) setCurrentUser(user || {});
      })
      .catch((error) => {
        console.error("Failed to load current user:", error);
      })
      .finally(() => {
        if (isMounted) setUserLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const userName =
    currentUser.first_name || currentUser.last_name
      ? `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim()
      : currentUser.username || "Unknown User";

  const userRole = currentUser.role || "Unknown Role";
  const userRoleLabel = ROLE_LABELS[userRole] || userRole;
  const canViewRemittance = ROLE_NAV[userRole]?.includes("/dashboard/Remittance");
  const userInitials =
    userName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "US";

  if (!userLoaded) {
    return null;
  }

  if (currentUser.must_reset_password) {
    return (
      <ForcePasswordChange
        onChanged={() =>
          setCurrentUser((prev) => ({ ...prev, must_reset_password: false }))
        }
      />
    );
  }

  return (
    <div className="shell">
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {mobileNavOpen ? (
              <>
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </>
            )}
          </svg>
        </button>

        <div className="mobile-header-brand">
          <img src={sfcLogo} alt="SFC Logo" className="mobile-header-logo" />
          <span className="mobile-header-name">North Central Terminal</span>
        </div>
      </header>

      {mobileNavOpen && (
        <div
          className="mobile-nav-overlay"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar${mobileNavOpen ? " sidebar-open" : ""}`}>
        {/* Brand header */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <img
              src={sfcLogo}
              alt="SFC Logo"
              style={{ width: "30px", height: "30px", borderRadius: "40px" }}
            />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">North Central Terminal</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">Navigation</div>
          {NAV_GROUPS.map((group) =>
            group.filter((item) => ROLE_NAV[userRole]?.includes(item.to)),
          )
            .filter((group) => group.length > 0)
            .map((group, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <div className="sidebar-nav-divider" />}
                {group.map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/dashboard"}
                    className={({ isActive }) =>
                      isActive ? "nav-link nav-link-active" : "nav-link"
                    }
                  >
                    <Icon className="nav-link-icon" />
                    {label}
                  </NavLink>
                ))}
              </React.Fragment>
            ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="sidebar-avatar">{userInitials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{userName}</div>
            <div className="sidebar-user-role">{userRoleLabel}</div>
          </div>

          {/* Theme toggle */}
          <button
            className="sidebar-icon-btn"
            onClick={() => setDark((d) => !d)}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? (
              // sun icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              // moon icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>

          {/* Logout */}
          <button
            className="sidebar-icon-btn"
            onClick={async () => {
              const ok = await showConfirm("Are you sure you want to logout?");
              if (!ok) return;
              showToast("Logging out...", "info");
              setTimeout(() => apiService.logout(), 1200);
            }}
            title="Logout"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="main-content" ref={mainContentRef}>
        <GlobalNotices canViewRemittance={canViewRemittance} />
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="Dashboard" element={<Dashboard />} />
          <Route path="Requisition" element={<Requisition />} />
          <Route path="Queue" element={<Queue userRole={userRole} />} />
          <Route path="Dispatch" element={<Dispatch />} />
          <Route
            path="Collections"
            element={<Collections userRole={userRole} />}
          />
          <Route
            path="Remittance"
            element={<Remittance />}
          />
          <Route path="Registry" element={<Registry />} />
          <Route
            path="StaffRegistry"
            element={<StaffRegistry userRole={userRole} />}
          />
          <Route path="Reports" element={<Reports />} />
          <Route path="Settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Mobile-only quick access to the scanner — draggable FAB, not the
          header button, so it stays reachable from any dashboard page and
          any scroll position without permanently covering content. */}
      {!mobileNavOpen && (
        <button
          type="button"
          className={`mobile-scan-fab${fabDimmed ? " mobile-scan-fab-dimmed" : ""}${fabDragging ? " mobile-scan-fab-dragging" : ""}`}
          style={fabPos ? { left: fabPos.x, top: fabPos.y, right: "auto", bottom: "auto" } : undefined}
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          onPointerCancel={handleFabPointerUp}
          aria-label="Open mobile scan (drag to move)"
          title="Mobile Scan — drag to move"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <rect x="7" y="7" width="10" height="10" rx="1" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default mainIndex;
