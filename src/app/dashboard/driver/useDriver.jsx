import { useState, useEffect } from "react";
import { apiService } from "../../../lib/api-service";
import { useConfirm, useToast } from "../../../components/ui/ToastConfirmContext";
import { buildDriverPayload, normalizeDriverForm, validateDriverForm } from "./driver-utils";

const EMPTY_FORM = {
  first_name: "",
  middle_name: "",
  last_name: "",
  iwp_number: "",
  iwp_expiration_date: "",
  gender: "",
  birthdate: "",
  province: "La Union",
  city: "",
  barangay: "",
  street: "",
  contact: "",
  status: "ACTIVE",
  is_archived: false,
  photo: null,
};

// Field defined OUTSIDE component to prevent remount (fixes input deselect bug)
export const Field = ({ label, children }) => (
  <div>
    <label
      className="block text-xs font-semibold uppercase tracking-wider mb-1"
      style={{ color: "#1a2744" }}
    >
      {label}
    </label>
    {children}
  </div>
);

export const inputCls =
  "w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2";

export function useDriver() {
  const [drivers, setDrivers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Only starts validating on the fly once a submit attempt has failed —
  // recomputed on every render so a field's error clears the moment it's filled in.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fieldErrors = submitAttempted ? validateDriverForm(form) : {};

  const showConfirm = useConfirm();
  const showToast = useToast();

  useEffect(() => {
    fetchDrivers();
    fetchTickets();
  }, []);

  const fetchDrivers = async () => {
    try {
      const data = await apiService.getDrivers({ is_archived: "false" });
      setDrivers((data || []).map(normalizeDriverForm));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const data = await apiService.getTickets({ status: "QUEUED" });
      setTickets(data);
    } catch {
      /* non-critical */
    }
  };

  // Check if driver has an active (QUEUED) ticket
  const isDriverOnActiveTicket = (driverId) =>
    tickets.some((t) => t.driver?.id === driverId && t.status === "QUEUED");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateDriverForm(form);
    if (Object.keys(errors).length > 0) {
      setSubmitAttempted(true);
      setError("Please fill in the highlighted fields.");
      return;
    }
    // Guard: cannot set INACTIVE if driver has an active ticket
    if (
      editing &&
      form.status === "INACTIVE" &&
      isDriverOnActiveTicket(editing.id)
    ) {
      setError(
        "Cannot set driver to Inactive — this driver has an active ticket. Resolve the ticket first.",
      );
      return;
    }
    const confirmMsg = editing ? "Confirm update?" : "Confirm registry?";
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;
    try {
      const payload = buildDriverPayload({ ...form, qr_code: form.iwp_number.trim() });
      if (editing) {
        await apiService.updateDriver(editing.id, payload);
      } else {
        await apiService.createDriver(payload);
      }
      fetchDrivers();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (driver) => {
    setEditing(driver);
    setForm(normalizeDriverForm(driver));
    setSubmitAttempted(false);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSubmitAttempted(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setSubmitAttempted(false);
  };

  const handleArchive = async (id) => {
    if (isDriverOnActiveTicket(id)) {
      showToast(
        "Cannot archive this driver — they have an active ticket. Resolve the ticket first.",
        "info",
      );
      return;
    }
    const confirmed = await showConfirm("Archive this driver? You can restore them from Settings → Archive.");
    if (!confirmed) return;
    try {
      await apiService.patch(`/drivers/${id}/`, { is_archived: true });
      fetchDrivers();
      showToast("Driver archived");
    } catch (err) {
      setError(err.message);
      showToast(err.message || "Failed to archive driver", "info");
    }
  };

  return {
    drivers,
    loading,
    error,
    fieldErrors,
    editing,
    isModalOpen,
    form,
    setForm,
    isDriverOnActiveTicket,
    handleSubmit,
    handleEdit,
    handleAdd,
    closeModal,
    handleArchive,
  };
}
