import { useState, useEffect } from "react";
import { apiService } from "./api-service";

const formatLabel = (name, startHour, endHour) => {
  const start =
    startHour < 12
      ? `${startHour}am`
      : startHour === 12
        ? "12pm"
        : `${startHour - 12}pm`;
  const end =
    endHour < 12
      ? `${endHour}am`
      : endHour === 12
        ? "12pm"
        : `${endHour - 12}pm`;
  return `${name} (${start}-${end})`;
};

const transformShifts = (data) => {
  const transformed = {};
  for (const [key, shift] of Object.entries(data)) {
    const name = key
      .replace("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase()); // Batch 1
    const label = formatLabel(name, shift.startHour, shift.endHour);
    transformed[key] = {
      name,
      label,
      startHour: shift.startHour,
      endHour: shift.endHour,
    };
  }
  return transformed;
};

export function useShifts() {
  const [shifts, setShifts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const data = await apiService.getSchedules();
      const transformed = transformShifts(data);
      setShifts(transformed);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const updateShifts = async (newShifts) => {
    try {
      // Strip name and label before sending to API
      const stripped = {};
      for (const [key, shift] of Object.entries(newShifts)) {
        stripped[key] = {
          startHour: shift.startHour,
          endHour: shift.endHour,
        };
      }
      await apiService.updateSchedules(stripped);
      setShifts(newShifts);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return { shifts, loading, error, updateShifts, refetch: fetchShifts };
}
