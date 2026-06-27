/**
 * useEditGrant — real-time timed access grant for restricted edit actions.
 *
 * PERSONNEL users cannot edit Ticket Price or Batch Schedule directly.
 * A SUPERVISOR / MANAGER / ADMIN must enter their credentials in-tab to
 * grant a timed editing window (GRANT_DURATION_MS).  The grant is stored in
 * sessionStorage (tab-isolated) and expires automatically.
 *
 * Usage:
 *   const grant = useEditGrant("ticketPrice");
 *   grant.hasAccess          // true when allowed to edit
 *   grant.remainingLabel     // "28:43" countdown string (only when active)
 *   grant.requestGrant(username, password)  // supervisor authenticates
 *   grant.revokeGrant()      // explicit revoke
 */

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE_URL = "http://localhost:8000/api";
const GRANT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const PRIVILEGED_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR"];

// sessionStorage key per feature
const storageKey = (feature) => `editGrant_${feature}`;

function loadGrant(feature) {
  try {
    const raw = sessionStorage.getItem(storageKey(feature));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveGrant(feature, grantedBy, expiresAt) {
  sessionStorage.setItem(
    storageKey(feature),
    JSON.stringify({ grantedBy, expiresAt })
  );
}

function clearGrant(feature) {
  sessionStorage.removeItem(storageKey(feature));
}

function isGrantValid(grant) {
  return grant && Date.now() < grant.expiresAt;
}

function formatRemaining(ms) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export function useEditGrant(feature, userRole) {
  const isPrivileged = PRIVILEGED_ROLES.includes((userRole || "").toUpperCase());

  const [grant, setGrant] = useState(() => loadGrant(feature));
  const [remainingMs, setRemainingMs] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [grantError, setGrantError] = useState("");
  const tickRef = useRef(null);

  // Sync grant from sessionStorage every second and count down
  useEffect(() => {
    const tick = () => {
      const current = loadGrant(feature);
      if (!isGrantValid(current)) {
        if (current) clearGrant(feature);  // clean up expired entry
        setGrant(null);
        setRemainingMs(0);
      } else {
        setGrant(current);
        setRemainingMs(current.expiresAt - Date.now());
      }
    };
    tick(); // immediate
    tickRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickRef.current);
  }, [feature]);

  const hasAccess = isPrivileged || isGrantValid(grant);

  // Request grant: authenticate as a privileged user in-tab
  const requestGrant = useCallback(
    async (username, password) => {
      setGrantError("");
      setRequesting(true);
      try {
        // Step 1: obtain token for the authorising user
        const tokenRes = await fetch(`${API_BASE_URL}/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!tokenRes.ok) throw new Error("Invalid credentials.");
        const { access } = await tokenRes.json();

        // Step 2: confirm the authorising user has a privileged role
        const userRes = await fetch(`${API_BASE_URL}/current-user/`, {
          headers: { Authorization: `Bearer ${access}` },
        });
        if (!userRes.ok) throw new Error("Could not verify authoriser role.");
        const authoriser = await userRes.json();
        const role = (authoriser.role || "").toUpperCase();
        if (!PRIVILEGED_ROLES.includes(role)) {
          throw new Error("Only SUPERVISOR, MANAGER, or ADMIN can grant access.");
        }

        // Step 3: persist timed grant (does NOT touch the current tab's token)
        const expiresAt = Date.now() + GRANT_DURATION_MS;
        saveGrant(feature, authoriser.username, expiresAt);
        setGrant({ grantedBy: authoriser.username, expiresAt });
        setRemainingMs(GRANT_DURATION_MS);
        return true;
      } catch (err) {
        setGrantError(err.message || "Grant failed.");
        return false;
      } finally {
        setRequesting(false);
      }
    },
    [feature]
  );

  const revokeGrant = useCallback(() => {
    clearGrant(feature);
    setGrant(null);
    setRemainingMs(0);
  }, [feature]);

  return {
    hasAccess,
    isPrivileged,
    grant,
    remainingMs,
    remainingLabel: formatRemaining(remainingMs),
    requesting,
    grantError,
    setGrantError,
    requestGrant,
    revokeGrant,
  };
}
