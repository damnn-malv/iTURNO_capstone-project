import React, { useState } from "react";
import { apiService } from "../api-service";
import { useShifts } from "../useShifts";

const LateTicketIssue = ({ vehicles, drivers, ticketFee, onClose }) => {
  const [lateDate, setLateDate] = useState("");
  const [lateBatch, setLateBatch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const { shifts: scheduleShifts } = useShifts();

  const handleDateChange = (e) => setLateDate(e.target.value);
  const handleBatchChange = (e) => setLateBatch(e.target.value);
  const handleVehicleChange = (e) => {
    const vehicle = vehicles.find((v) => v.id === parseInt(e.target.value));
    setSelectedVehicle(vehicle);
  };
  const handleDriverChange = (e) => {
    const driver = drivers.find((d) => d.id === parseInt(e.target.value));
    setSelectedDriver(driver);
  };

  const handleIssueLateTicket = async () => {
    if (!lateDate || !lateBatch || !selectedVehicle || !selectedDriver) {
      alert("Please fill all fields");
      return;
    }
    if (
      !selectedVehicle.route_detail?.full_name &&
      !selectedVehicle.full_name
    ) {
      alert("Selected vehicle does not have a valid route assigned");
      return;
    }
    const payload = {
      vehicle: selectedVehicle.id,
      driver: selectedDriver.id,
      route: selectedVehicle.route_detail?.id || selectedVehicle.route || null,
      status: "ISSUED",
      is_late: true,
      intended_batch: lateBatch,
      issued_at: new Date(lateDate).toISOString(),
      collection_amount: ticketFee,
    };
    try {
      await apiService.post("/tickets/late/", payload);
      alert("Late ticket issued successfully!");
      window.location.reload();
    } catch (error) {
      if (error.response && error.response.data) {
        alert("Server rejected fields: " + JSON.stringify(error.response.data));
      } else {
        alert("Error issuing late ticket: " + error.message);
      }
    }
  };

  const formatHour = (hour) => {
    const suffix = hour >= 12 ? "pm" : "am";
    const display = ((hour + 11) % 12) + 1;
    return `${display}${suffix}`;
  };

  return (
    <div
      className="ticket-overlay"
      onClick={(onClose, () => window.location.reload())}
    >
      <div className="ticket-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ticket-modal-header">
          <div className="ticket-modal-header-left">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#c9a84c"
              strokeWidth="2"
            >
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
            <h2 className="ticket-modal-title">Issue Late Ticket</h2>
          </div>
          <button
            className="ticket-modal-close"
            onClick={(onClose, () => window.location.reload())}
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="ticket-modal-body">
          {/* Late issuance notice */}
          <div className="ticket-warning" style={{ marginBottom: 0 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="ticket-warning-icon"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <div className="ticket-warning-body">
              <span className="ticket-warning-msg">
                This ticket will be recorded as a late issuance for a past date.
              </span>
            </div>
          </div>

          {/* Date */}
          <div className="ticket-field">
            <label className="ticket-label">Date</label>
            <input
              type="date"
              className="ticket-select"
              value={lateDate}
              onChange={handleDateChange}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Batch */}
          <div className="ticket-field">
            <label className="ticket-label">Batch</label>
            <select
              className="ticket-select"
              value={lateBatch}
              onChange={handleBatchChange}
            >
              <option value="">— Select Batch —</option>
              {Object.entries(scheduleShifts).map(([key, shift]) => (
                <option key={key} value={shift.name}>
                  {shift.name} ({formatHour(shift.startHour)}–
                  {formatHour(shift.endHour)})
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle */}
          <div className="ticket-field">
            <label className="ticket-label">Vehicle</label>
            <select
              className="ticket-select"
              value={selectedVehicle?.id || ""}
              onChange={handleVehicleChange}
            >
              <option value="">— Select Vehicle —</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate_number} —{" "}
                  {vehicle.route_detail?.full_name || "N/A"}
                </option>
              ))}
            </select>
          </div>

          {/* Driver */}
          <div className="ticket-field">
            <label className="ticket-label">Driver</label>
            <select
              className="ticket-select"
              value={selectedDriver?.id || ""}
              onChange={handleDriverChange}
            >
              <option value="">— Select Driver —</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="ticket-modal-footer">
          <button
            type="button"
            className="ticket-modal-btn ticket-modal-btn--cancel"
            onClick={(onClose, () => window.location.reload())}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ticket-modal-btn ticket-modal-btn--submit"
            onClick={handleIssueLateTicket}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              <path d="M13 5v2" />
              <path d="M13 17v2" />
              <path d="M13 11v2" />
            </svg>
            Issue Ticket
          </button>
        </div>
      </div>
    </div>
  );
};

export default LateTicketIssue;
