import React, { useEffect, useMemo, useState } from "react";
import { apiService } from "../../../lib/api-service";
import { useQueueSocket } from "../../../lib/useQueueSocket";
import "../../../styles/Dispatch.css";

// Mirrors DEFAULT_ESTIMATED_LOADING_MINUTES in backend/api/views/records.py —
// the loading-time fallback for a route with no estimated_loading_minutes set.
const DEFAULT_ESTIMATED_LOADING_MINUTES = 5;
const EXTEND_OPTIONS_MINUTES = [5, 10, 15];

// The ticket series + quantity picker is shared with the Queue page (roaming
// check-ins use the same selection), so its state lives in useQueue.
function Dispatch({ availableSeries, allSeries = [], setSeriesOverrideId = () => {}, selectedSeriesId, setSelectedSeriesId, ticketQuantity, setTicketQuantity, onStockChange }) {
  const [pickSeries, setPickSeries] = useState(false);
  const selected = allSeries.find((s) => String(s.id) === String(selectedSeriesId));
  const [vehicles, setVehicles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [now, setNow] = useState(() => Date.now());
  const [extendingTicketId, setExtendingTicketId] = useState(null);
  const [roamingVehicleId, setRoamingVehicleId] = useState(null);

  const [dragVehicleId, setDragVehicleId] = useState(null);
  const [dragOverVehicleId, setDragOverVehicleId] = useState(null);
  const [reorderingRouteId, setReorderingRouteId] = useState(null);
  const [reorderError, setReorderError] = useState("");

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [swapTarget, setSwapTarget] = useState(null);
  const [swapDriverId, setSwapDriverId] = useState("");
  const [swapDriverQuery, setSwapDriverQuery] = useState("");
  const [showSwapDriverDropdown, setShowSwapDriverDropdown] = useState(false);
  const [swapError, setSwapError] = useState("");
  const [swapping, setSwapping] = useState(false);

  const [dispatchError, setDispatchError] = useState("");
  const [dispatchingVehicleId, setDispatchingVehicleId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Ticks the loading-time countdowns once a second — purely a display
  // concern, doesn't touch any fetched data.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [vehicleData, ticketData, driverData, routeData] = await Promise.all([
        apiService.getVehicles({ status: "QUEUED", is_archived: "false" }),
        apiService.getTickets({ status: "QUEUED" }),
        apiService.getDrivers({ status: "ACTIVE", is_archived: "false" }),
        apiService.getRoutes(),
      ]);
      setVehicles(vehicleData);
      setTickets(ticketData);
      setDrivers(driverData);
      setRoutes(routeData);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Backend pushes a "queue_updated" ping whenever a vehicle/ticket change
  // affects the board (e.g. a Check In from Ticket), so we refetch right away
  // instead of waiting for someone to leave and revisit this tab.
  useQueueSocket(() => fetchData(true));

  const routeById = useMemo(() => {
    const map = new Map();
    for (const r of routes) map.set(r.id, r);
    return map;
  }, [routes]);

  // Server already scopes vehicles (status=QUEUED, is_archived=false) and tickets
  // (status=QUEUED) — see fetchData(). This Map indexes the small remaining
  // `tickets` array by vehicle so queue/render logic doesn't rescan it per row
  // on every render (e.g. every keystroke in the Cancel/Swap modals).
  const openTicketByVehicleId = useMemo(() => {
    const map = new Map();
    for (const t of tickets) {
      if (t.status === "QUEUED" && t.vehicle?.id != null && !map.has(t.vehicle.id)) {
        map.set(t.vehicle.id, t);
      }
    }
    return map;
  }, [tickets]);

  const queue = useMemo(
    () =>
      vehicles.filter(
        (v) => v.status === "QUEUED" && !v.is_archived && openTicketByVehicleId.has(v.id),
      ),
    [vehicles, openTicketByVehicleId],
  );

  const getQueuedAt = (vehicle) => {
    const ticket = openTicketByVehicleId.get(vehicle.id);
    return ticket?.issued_at
      ? new Date(ticket.issued_at).getTime()
      : Number.POSITIVE_INFINITY;
  };

  // Manual drag-and-drop order (see reorder-queue) takes priority; vehicles
  // that were never reordered (or joined after) fall back to plain FIFO —
  // mirrors the backend's order_by('queue_rank', 'issued_at').
  const getQueueRank = (vehicle) => {
    const ticket = openTicketByVehicleId.get(vehicle.id);
    return ticket?.queue_rank ?? Number.POSITIVE_INFINITY;
  };

  const groupedByRoute = useMemo(() => {
    const groups = queue.reduce((acc, vehicle) => {
      const routeName = vehicle.route_detail?.full_name || "No Route Assigned";
      if (!acc[routeName]) {
        acc[routeName] = { routeId: vehicle.route_detail?.id ?? null, vehicles: [] };
      }
      acc[routeName].vehicles.push(vehicle);
      return acc;
    }, {});

    Object.keys(groups).forEach((routeName) => {
      groups[routeName].vehicles.sort((a, b) => {
        const rankDiff = getQueueRank(a) - getQueueRank(b);
        return rankDiff !== 0 ? rankDiff : getQueuedAt(a) - getQueuedAt(b);
      });
    });

    return groups;
  }, [queue, openTicketByVehicleId]);

  const sortedRoutes = useMemo(() => Object.keys(groupedByRoute).sort(), [groupedByRoute]);

  // Deadline for the vehicle currently at the front of its route's line —
  // route's configured estimate (or the shared default), plus any one-off
  // extension applied to just this ticket (see handleExtendLoading).
  const getLoadingDeadline = (vehicle) => {
    const ticket = openTicketByVehicleId.get(vehicle.id);
    if (!ticket?.loading_started_at) return null;
    const routeId = vehicle.route_detail?.id;
    const routeMinutes = routeId != null ? routeById.get(routeId)?.estimated_loading_minutes : null;
    const minutes = (routeMinutes ?? DEFAULT_ESTIMATED_LOADING_MINUTES) + (ticket.extra_loading_minutes || 0);
    return new Date(ticket.loading_started_at).getTime() + minutes * 60000;
  };

  const formatCountdown = (deadlineMs) => {
    const diffMs = deadlineMs - now;
    const overdue = diffMs < 0;
    const abs = Math.abs(diffMs);
    const mins = Math.floor(abs / 60000);
    const secs = Math.floor((abs % 60000) / 1000);
    return `${overdue ? "-" : ""}${mins}:${String(secs).padStart(2, "0")}`;
  };

  const getDriverName = (vehicle) => {
    if (vehicle.active_driver_name) return vehicle.active_driver_name;
    const ticket = openTicketByVehicleId.get(vehicle.id);
    return ticket?.driver?.name || "—";
  };

  const handleDispatch = async (vehicle) => {
    if (!selectedSeriesId) {
      setDispatchError("Please select a ticket series before dispatching.");
      return;
    }
    const quantity = Math.max(1, parseInt(ticketQuantity) || 1);
    setDispatchingVehicleId(vehicle.id);
    setDispatchError("");
    try {
      await apiService.dispatchTicket(vehicle.id, {
        seriesId: selectedSeriesId,
        quantity,
      });
      // Small delay so the "Dispatching…" state is perceptible before the row
      // disappears; fetchData(true) reconciles everything else in the background.
      await new Promise((resolve) => setTimeout(resolve, 500));
      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
      fetchData(true);
      onStockChange?.();
    } catch (err) {
      setDispatchError(err.message || "Failed to dispatch ticket. Please try again.");
    } finally {
      setDispatchingVehicleId(null);
    }
  };

  const handleExtendLoading = async (vehicle, minutes) => {
    const ticket = openTicketByVehicleId.get(vehicle.id);
    if (!ticket) return;
    setExtendingTicketId(ticket.id);
    try {
      await apiService.patch(`/tickets/${ticket.id}/`, {
        extra_loading_minutes: (ticket.extra_loading_minutes || 0) + minutes,
      });
      fetchData(true);
    } catch (err) {
      setDispatchError(err.message || "Failed to extend loading time.");
    } finally {
      setExtendingTicketId(null);
    }
  };

  // Lets a driver anywhere in the line (not just the front) pay the terminal
  // fee now and leave instead of waiting their turn — reuses the same
  // denomination/quantity picker as a normal Dispatch.
  const handleRoam = async (vehicle) => {
    if (!selectedSeriesId) {
      setDispatchError("Please select a ticket series before converting to roam.");
      return;
    }
    const quantity = Math.max(1, parseInt(ticketQuantity) || 1);
    setRoamingVehicleId(vehicle.id);
    setDispatchError("");
    try {
      await apiService.convertToRoam(vehicle.id, {
        seriesId: selectedSeriesId,
        quantity,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
      fetchData(true);
      onStockChange?.();
    } catch (err) {
      setDispatchError(err.message || "Failed to convert to roam. Please try again.");
    } finally {
      setRoamingVehicleId(null);
    }
  };

  // Persists a drag-and-drop reorder within one route's line — the backend
  // rewrites queue_rank for the whole route to match, and every connected
  // client picks it up on the next queue_updated ping.
  const handleReorderDrop = async (routeName, routeId, targetVehicleId) => {
    const sourceId = dragVehicleId;
    setDragVehicleId(null);
    setDragOverVehicleId(null);
    if (routeId == null || sourceId == null || sourceId === targetVehicleId) return;

    const currentOrder = groupedByRoute[routeName].vehicles.map((v) => v.id);
    const fromIdx = currentOrder.indexOf(sourceId);
    const toIdx = currentOrder.indexOf(targetVehicleId);
    if (fromIdx === -1 || toIdx === -1) return;

    const nextOrder = [...currentOrder];
    nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, sourceId);

    setReorderingRouteId(routeId);
    setReorderError("");
    try {
      await apiService.reorderQueue(routeId, nextOrder);
    } catch (err) {
      setReorderError(err.message || "Failed to reorder queue.");
    } finally {
      setReorderingRouteId(null);
      fetchData(true);
    }
  };

  // Server already filters to status=ACTIVE — see fetchData().
  const activeDrivers = drivers;

  const swapDriverResults = activeDrivers.filter((d) =>
    d.name.toLowerCase().includes(swapDriverQuery.toLowerCase()),
  );

  const openSwapModal = (vehicle) => {
    setSwapTarget(vehicle);
    setSwapDriverId("");
    setSwapDriverQuery("");
    setSwapError("");
  };

  const closeSwapModal = () => {
    if (swapping) return;
    setSwapTarget(null);
    setSwapDriverId("");
    setSwapDriverQuery("");
    setShowSwapDriverDropdown(false);
    setSwapError("");
  };

  const selectSwapDriver = (driver) => {
    setSwapDriverId(driver.id);
    setSwapDriverQuery(driver.name);
    setShowSwapDriverDropdown(false);
    if (swapError) setSwapError("");
  };

  const handleConfirmSwap = async () => {
    if (!swapDriverId) {
      setSwapError("Please select a driver.");
      return;
    }
    setSwapping(true);
    setSwapError("");
    try {
      const openTicket = openTicketByVehicleId.get(swapTarget.id);
      if (!openTicket) {
        throw new Error("No open ticket found for this vehicle.");
      }
      await apiService.reassignTicketDriver(openTicket.id, swapDriverId);
      await fetchData();
      closeSwapModal();
    } catch (err) {
      setSwapError(err.message || "Failed to reassign driver. Please try again.");
    } finally {
      setSwapping(false);
    }
  };

  const openCancelModal = (vehicle) => {
    setCancelTarget(vehicle);
    setCancelReason("");
    setCancelError("");
  };

  const closeCancelModal = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason("");
    setCancelError("");
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelError("Please provide a reason for cancellation.");
      return;
    }
    setCancelling(true);
    setCancelError("");
    try {
      // Cancel every QUEUED ticket for this vehicle — quantity > 1 issuance
      // creates multiple tickets that all belong to the same pending trip.
      const activeTickets = tickets.filter(
        (t) => t.vehicle?.id === cancelTarget.id && t.status === "QUEUED",
      );
      await Promise.all(
        activeTickets.map((t) =>
          apiService.patch(`/tickets/${t.id}/`, {
            status: "CANCELLED",
            reason: cancelReason.trim(),
          }),
        ),
      );
      await apiService.patch(`/vehicles/${cancelTarget.id}/`, {
        status: "AVAILABLE",
      });
      await fetchData();
      closeCancelModal();
    } catch (err) {
      setCancelError(
        err.message || "Failed to cancel ticket. Please try again.",
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="dispatch-page">
      {error && (
        <div className="dispatch-error">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {reorderError && (
        <div className="dispatch-error">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {reorderError}
        </div>
      )}

      <div className="dispatch-settings-panel">
       
        <div className="dispatch-settings-body">
          <div className="dispatch-modal-field">
            <label className="dispatch-modal-label">
              Ticket Denomination <span className="dispatch-modal-required">*</span>
            </label>
            <div className="dispatch-series-row">
              <select
                className="dispatch-modal-select"
                value={selectedSeriesId}
                onChange={(e) => {
                  setSelectedSeriesId(e.target.value);
                  if (dispatchError) setDispatchError("");
                }}
              >
                {availableSeries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ticket_form_label || "Unspecified"}
                  </option>
                ))}
              </select>
              {selectedSeriesId && (
                <button
                  type="button"
                  className="dispatch-series-toggle"
                  onClick={() => {
                    if (pickSeries) setSeriesOverrideId("");
                    setPickSeries(!pickSeries);
                  }}
                >
                  {pickSeries ? "Use default" : "Pick series"}
                </button>
              )}
            </div>
            {pickSeries && selectedSeriesId && (
              <select
                className="dispatch-modal-select"
                value={selectedSeriesId}
                onChange={(e) => setSeriesOverrideId(e.target.value)}
              >
                {allSeries
                  .filter((s) => (s.ticket_form_label || "Unspecified") === (selected?.ticket_form_label || "Unspecified"))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      Series {s.series_no} ({s.pcs} pcs remaining)
                    </option>
                  ))}
              </select>
            )}
            {availableSeries.length === 0 && (
              <span className="dispatch-modal-field-error">
                No ticket series with stock available.
              </span>
            )}
          </div>

          <div className="dispatch-modal-field dispatch-settings-qty">
            <label className="dispatch-modal-label">Quantity</label>
            <input
              type="number"
              className="dispatch-modal-select"
              min={1}
              value={ticketQuantity}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setTicketQuantity(Number.isNaN(val) ? "" : Math.max(1, val));
                if (dispatchError) setDispatchError("");
              }}
              onBlur={() => !ticketQuantity && setTicketQuantity(1)}
            />
          </div>
        </div>
        {dispatchError && (
          <span className="dispatch-modal-field-error dispatch-settings-error">
            {dispatchError}
          </span>
        )}
      </div>

      <div className="dispatch-panel">
        <div className="dispatch-panel-header">
          <div className="dispatch-panel-header-left">
            <span className="dispatch-panel-indicator" />
            <span className="dispatch-panel-title">Queued Vehicles</span>
          </div>
          <span className="dispatch-panel-count">{queue.length}</span>
        </div>

        <div className="dispatch-panel-body">
          {loading ? (
            <div className="dispatch-state-wrap">
              <div className="dispatch-loading-dots">
                <div />
                <div />
                <div />
              </div>
            </div>
          ) : queue.length === 0 ? (
            <div className="dispatch-state-wrap dispatch-state-wrap--empty">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.3"
              >
                <rect x="1" y="3" width="15" height="13" rx="1" />
                <path d="M16 8h4l3 3v5h-7V8z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              <span>No vehicles in queue</span>
            </div>
          ) : (
            <div className="dispatch-routes-list">
              {sortedRoutes.map((routeName) => {
                const { routeId, vehicles: routeVehicles } = groupedByRoute[routeName];
                const isReordering = reorderingRouteId === routeId;
                return (
                <div
                  key={routeName}
                  className="dispatch-route-group"
                >
                  <div className="dispatch-route-label">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{routeName}</span>
                    <span className="dispatch-route-label-count">
                      {routeVehicles.length} vehicle
                      {routeVehicles.length !== 1 ? "s" : ""}
                    </span>
                    {isReordering && (
                      <span className="dispatch-route-label-saving">Saving order…</span>
                    )}
                  </div>

                  <div className="dispatch-table-wrap">
                    <table className="dispatch-table">
                      <thead>
                        <tr>
                          <th className="dispatch-th-order">Order</th>
                          <th>Plate No.</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routeVehicles.map(
                          (vehicle, vehicleIdx) => {
                            const canDispatch = vehicleIdx === 0;
                            const canReorder = routeId != null;
                            const deadline = canDispatch ? getLoadingDeadline(vehicle) : null;
                            const ticket = openTicketByVehicleId.get(vehicle.id);
                            const isOverdue = deadline != null && deadline - now < 0;
                            return (
                              <tr
                                key={vehicle.id}
                                className={`dispatch-table-row${dragOverVehicleId === vehicle.id ? " dispatch-table-row--drag-over" : ""}${dragVehicleId === vehicle.id ? " dispatch-table-row--dragging" : ""}`}
                                draggable={canReorder}
                                onDragStart={() => canReorder && setDragVehicleId(vehicle.id)}
                                onDragOver={(e) => {
                                  if (!canReorder) return;
                                  e.preventDefault();
                                  if (dragOverVehicleId !== vehicle.id) setDragOverVehicleId(vehicle.id);
                                }}
                                onDragEnd={() => {
                                  setDragVehicleId(null);
                                  setDragOverVehicleId(null);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  handleReorderDrop(routeName, routeId, vehicle.id);
                                }}
                              >
                                <td className="dispatch-td-order">
                                  {canReorder ? (
                                    <span
                                      className="dispatch-drag-handle"
                                      title="Drag to reorder this route's queue"
                                    >
                                      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                                        <circle cx="3" cy="2.5" r="1.4" />
                                        <circle cx="9" cy="2.5" r="1.4" />
                                        <circle cx="3" cy="8" r="1.4" />
                                        <circle cx="9" cy="8" r="1.4" />
                                        <circle cx="3" cy="13.5" r="1.4" />
                                        <circle cx="9" cy="13.5" r="1.4" />
                                      </svg>
                                    </span>
                                  ) : null}
                                  <span className="dispatch-order-index">#{vehicleIdx + 1}</span>
                                </td>
                                <td>
                                  <span className="dispatch-plate">
                                    {vehicle.plate_number}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`dispatch-status-badge${canDispatch ? " dispatch-status-badge--queued" : " dispatch-status-badge--other"}`}
                                  >
                                    <span
                                      className={`dispatch-status-dot${canDispatch ? " dispatch-status-dot--active" : " dispatch-status-dot--inactive"}`}
                                    />
                                    {canDispatch
                                      ? "Ready"
                                      : `#${vehicleIdx + 1} in line`}
                                  </span>
                                  {deadline != null && (
                                    <span className={`dispatch-loading-timer${isOverdue ? " dispatch-loading-timer--overdue" : ""}`}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3 3" />
                                      </svg>
                                      {formatCountdown(deadline)}
                                      {EXTEND_OPTIONS_MINUTES.map((minutes) => (
                                        <button
                                          key={minutes}
                                          type="button"
                                          className="dispatch-extend-btn"
                                          onClick={() => handleExtendLoading(vehicle, minutes)}
                                          disabled={extendingTicketId === ticket?.id}
                                          title={`Extend by ${minutes} minutes`}
                                        >
                                          +{minutes}m
                                        </button>
                                      ))}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <div className="dispatch-action-group">
                                    <button
                                      className={`dispatch-btn dispatch-btn--dispatch${!canDispatch ? " dispatch-btn--dispatch-disabled" : ""}`}
                                      onClick={() =>
                                        canDispatch && handleDispatch(vehicle)
                                      }
                                      disabled={
                                        !canDispatch ||
                                        dispatchingVehicleId === vehicle.id
                                      }
                                      title={
                                        !canDispatch
                                          ? `Waiting — #${vehicleIdx + 1} in line for this route`
                                          : "Dispatch vehicle"
                                      }
                                    >
                                      <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                      >
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                      </svg>
                                      {dispatchingVehicleId === vehicle.id
                                        ? "Dispatching…"
                                        : "Dispatch"}
                                    </button>
                                    <button
                                      className="dispatch-btn dispatch-btn--roam"
                                      onClick={() => handleRoam(vehicle)}
                                      disabled={roamingVehicleId === vehicle.id}
                                      title="Pay the terminal fee now and leave without waiting in line"
                                    >
                                      <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                      >
                                        <path d="M3 12h13M11 6l6 6-6 6M21 5v14" />
                                      </svg>
                                      {roamingVehicleId === vehicle.id ? "Roaming…" : "Roam"}
                                    </button>
                                    <button
                                      className="dispatch-btn dispatch-btn--swap"
                                      onClick={() => openSwapModal(vehicle)}
                                    >
                                      <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                      >
                                        <path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />
                                      </svg>
                                      Swap Driver
                                    </button>
                                    <button
                                      className="dispatch-btn dispatch-btn--cancel"
                                      onClick={() => openCancelModal(vehicle)}
                                    >
                                      <svg
                                        width="13"
                                        height="13"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                      >
                                        <path d="M18 6 6 18M6 6l12 12" />
                                      </svg>
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {cancelTarget && (
        <div className="dispatch-overlay" onClick={closeCancelModal}>
          <div className="dispatch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dispatch-modal-header">
              <div className="dispatch-modal-header-left">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c9a84c"
                  strokeWidth="2.2"
                >
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
                <h2 className="dispatch-modal-title">Cancel Ticket</h2>
              </div>
              <button
                className="dispatch-modal-close"
                onClick={closeCancelModal}
                disabled={cancelling}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="dispatch-modal-body">
              <div className="dispatch-cancel-vehicle">
                <div className="dispatch-cancel-vehicle__row">
                  <span className="dispatch-plate">
                    {cancelTarget.plate_number}
                  </span>
                  <span className="dispatch-cancel-vehicle__route">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {cancelTarget.route_detail?.full_name || "No route"}
                  </span>
                </div>
                <span className="dispatch-cancel-vehicle__driver">
                  Driver: {getDriverName(cancelTarget)}
                </span>
              </div>

              <div className="dispatch-cancel-warning">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ flexShrink: 0, marginTop: 1 }}
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                <span>
                  This will cancel the issued ticket and return the vehicle to{" "}
                  <strong>Available</strong> status. This action cannot be
                  undone.
                </span>
              </div>

              <div className="dispatch-modal-field">
                <label className="dispatch-modal-label">
                  Reason for Cancellation{" "}
                  <span className="dispatch-modal-required">*</span>
                </label>
                <textarea
                  className="dispatch-modal-textarea"
                  rows={3}
                  placeholder="Enter the reason for cancelling this ticket…"
                  value={cancelReason}
                  onChange={(e) => {
                    setCancelReason(e.target.value);
                    if (cancelError) setCancelError("");
                  }}
                  disabled={cancelling}
                />
                {cancelError && (
                  <span className="dispatch-modal-field-error">
                    {cancelError}
                  </span>
                )}
              </div>
            </div>

            <div className="dispatch-modal-footer">
              <button
                type="button"
                className="dispatch-modal-btn dispatch-modal-btn--secondary"
                onClick={closeCancelModal}
                disabled={cancelling}
              >
                Go Back
              </button>
              <button
                type="button"
                className="dispatch-modal-btn dispatch-modal-btn--danger"
                onClick={handleConfirmCancel}
                disabled={cancelling || !cancelReason.trim()}
              >
                {cancelling ? (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      className="dispatch-modal-spin"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Cancelling…
                  </>
                ) : (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                    Confirm Cancel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {swapTarget && (
        <div className="dispatch-overlay" onClick={closeSwapModal}>
          <div className="dispatch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dispatch-modal-header">
              <div className="dispatch-modal-header-left">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b7791f"
                  strokeWidth="2.2"
                >
                  <path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />
                </svg>
                <h2 className="dispatch-modal-title">Swap Driver</h2>
              </div>
              <button
                className="dispatch-modal-close"
                onClick={closeSwapModal}
                disabled={swapping}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="dispatch-modal-body">
              <div className="dispatch-cancel-vehicle">
                <div className="dispatch-cancel-vehicle__row">
                  <span className="dispatch-plate">
                    {swapTarget.plate_number}
                  </span>
                  <span className="dispatch-cancel-vehicle__route">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {swapTarget.route_detail?.full_name || "No route"}
                  </span>
                </div>
                <span className="dispatch-cancel-vehicle__driver">
                  Current Driver: {getDriverName(swapTarget)}
                </span>
              </div>

              <div className="dispatch-modal-field">
                <label className="dispatch-modal-label">
                  New Driver <span className="dispatch-modal-required">*</span>
                </label>
                <div className="dispatch-driver-combobox">
                  <input
                    type="text"
                    className="dispatch-modal-select"
                    placeholder="Type to search drivers…"
                    value={swapDriverQuery}
                    onChange={(e) => {
                      setSwapDriverQuery(e.target.value);
                      setShowSwapDriverDropdown(true);
                      if (swapDriverId) setSwapDriverId("");
                    }}
                    onFocus={() => setShowSwapDriverDropdown(true)}
                    onBlur={() =>
                      setTimeout(() => setShowSwapDriverDropdown(false), 150)
                    }
                    disabled={swapping}
                  />
                  {showSwapDriverDropdown && (
                    <div className="dispatch-driver-dropdown">
                      {swapDriverResults.length === 0 ? (
                        <div className="dispatch-driver-dropdown-empty">
                          No matching drivers
                        </div>
                      ) : (
                        swapDriverResults.map((d) => (
                          <div
                            key={d.id}
                            className="dispatch-driver-dropdown-item"
                            onMouseDown={() => selectSwapDriver(d)}
                          >
                            {d.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {swapError && (
                  <span className="dispatch-modal-field-error">
                    {swapError}
                  </span>
                )}
              </div>
            </div>

            <div className="dispatch-modal-footer">
              <button
                type="button"
                className="dispatch-modal-btn dispatch-modal-btn--secondary"
                onClick={closeSwapModal}
                disabled={swapping}
              >
                Go Back
              </button>
              <button
                type="button"
                className="dispatch-modal-btn dispatch-modal-btn--primary"
                onClick={handleConfirmSwap}
                disabled={swapping || !swapDriverId}
              >
                {swapping ? "Swapping…" : "Confirm Swap"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dispatch;
