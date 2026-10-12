import { useEffect, useState } from "react";
import { apiService, IS_REMOTE } from "../../../../lib/api-service";

export function useTicketBackfill() {
  const [wipMode, setWipMode] = useState(null);
  const [wipLoading, setWipLoading] = useState(true);
  const [togglingWip, setTogglingWip] = useState(false);

  const [vehicles, setVehicles] = useState([]);
  const [ticketSeries, setTicketSeries] = useState([]);

  const [submitBusy, setSubmitBusy] = useState(false);

  // Remote has no live preview (see submitManualBackfill's comment in
  // api-service.js) — this list of queued requests + their apply status is
  // what stands in for it on the remote dashboard.
  const [remoteRequests, setRemoteRequests] = useState([]);
  const [remoteRequestsLoading, setRemoteRequestsLoading] = useState(false);

  // "Who backfilled what, when" — LAN-only, since the stored CSV file lives on
  // the LAN's local disk and isn't mirrored to Supabase for the remote dashboard.
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchRemoteRequests = () => {
    if (!IS_REMOTE) return Promise.resolve();
    setRemoteRequestsLoading(true);
    return apiService
      .getRemoteBackfillRequests()
      .then(setRemoteRequests)
      .catch((err) => console.error("Failed to load remote backfill requests:", err))
      .finally(() => setRemoteRequestsLoading(false));
  };

  const fetchHistory = () => {
    if (IS_REMOTE) return Promise.resolve();
    setHistoryLoading(true);
    return apiService
      .getBackfillHistory()
      .then((result) => setHistory(Array.isArray(result) ? result : result.results || []))
      .catch((err) => console.error("Failed to load backfill history:", err))
      .finally(() => setHistoryLoading(false));
  };

  const fetchWipMode = () => {
    setWipLoading(true);
    return apiService
      .getWipMode()
      .then(setWipMode)
      .catch((err) => console.error("Failed to load WIP mode:", err))
      .finally(() => setWipLoading(false));
  };

  useEffect(() => {
    fetchWipMode();
    fetchRemoteRequests();
    fetchHistory();
    apiService.getVehicles({ is_archived: "false" }).then(setVehicles).catch((err) => console.error("Failed to load vehicles:", err));
    apiService.request("/ticket-series/").then((r) => setTicketSeries(Array.isArray(r) ? r : r.results || [])).catch((err) => console.error("Failed to load ticket series:", err));
  }, []);

  const toggleWipMode = async (nextActive) => {
    setTogglingWip(true);
    try {
      const updated = await apiService.updateWipMode(nextActive);
      setWipMode(updated);
      return updated;
    } finally {
      setTogglingWip(false);
    }
  };

  // The whole batch goes in one call and is saved all-or-nothing. Returns one result
  // per row, in order, so the caller can show which row (if any) blocked the save.
  const submitRows = async (rows, commit) => {
    setSubmitBusy(true);
    try {
      const data = await apiService.submitBackfillBatch(rows, commit);
      // Remote only queues, so it has no per-row results.
      const results = rows.map((row, i) => ({ row, ...(data.results?.[i] || { outcome: data.outcome }) }));
      if (commit && data.outcome === "ok") await (IS_REMOTE ? fetchRemoteRequests() : fetchHistory());
      return results;
    } catch (err) {
      return rows.map((row) => ({ row, outcome: "error", reason: err.message || "Request failed" }));
    } finally {
      setSubmitBusy(false);
    }
  };

  return {
    wipMode, wipLoading, togglingWip, toggleWipMode,
    vehicles, ticketSeries,
    submitBusy, submitRows,
    remoteRequests, remoteRequestsLoading,
    history, historyLoading,
  };
}
