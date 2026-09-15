import { useCallback, useEffect, useState } from "react";
import { apiService } from "../../../lib/api-service";

const PAGE_SIZE = 25;

export function useRemittance() {
  const [showModal, setShowModal] = useState(false);
  const [batches, setBatches] = useState([]);
  const [meta, setMeta] = useState({ count: 0, totalPages: 1 });
  const [tabCounts, setTabCounts] = useState({ active: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // One server-paginated, tab-filtered page — the table only ever holds
  // PAGE_SIZE rows in memory, not every batch ever created.
  const fetchPage = useCallback(async (page, isArchived) => {
    const res = await apiService.get(
      `/report/remittance/?page=${page}&page_size=${PAGE_SIZE}&is_archived=${isArchived}`
    );
    return {
      results: res.results || [],
      count: res.count || 0,
      totalPages: res.total_pages || Math.max(Math.ceil((res.count || 0) / PAGE_SIZE), 1),
      page: res.page || page,
    };
  }, []);

  // Full (unpaginated) result set for a tab — used only once the user has
  // actually typed a search, so matching checks every batch in that tab
  // instead of just whichever page happens to be on screen.
  const fetchAllBatches = useCallback(async (isArchived) => {
    const res = await apiService.get(`/report/remittance/?is_archived=${isArchived}`);
    return Array.isArray(res) ? res : res.results || [];
  }, []);

  const fetchCount = useCallback(async (isArchived) => {
    const res = await apiService.get(`/report/remittance/?page=1&page_size=1&is_archived=${isArchived}`);
    return res.count || 0;
  }, []);

  const fetchTabCounts = useCallback(async () => {
    try {
      const [active, archived] = await Promise.all([fetchCount(false), fetchCount(true)]);
      setTabCounts({ active, archived });
    } catch (err) {
      console.error("Failed to load remittance tab counts", err);
    }
  }, [fetchCount]);

  // Loads a page and, if it comes back empty because the last item on it just
  // got archived/restored away, steps back one page instead of showing blank.
  const loadPage = useCallback(async (page, isArchived) => {
    setLoading(true);
    try {
      let data = await fetchPage(page, isArchived);
      if (data.results.length === 0 && page > 1 && data.count > 0) {
        data = await fetchPage(page - 1, isArchived);
      }
      setBatches(data.results);
      setMeta({ count: data.count, totalPages: data.totalPages });
      setError(null);
      return data;
    } catch (err) {
      console.error("Failed to load remittance batches", err);
      setError("Failed to load remittance batches");
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  // The initial page load is driven by the consuming component (which owns
  // the page/tab state) — this only needs to run once for the tab badge counts.
  useEffect(() => {
    fetchTabCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveBatch = async (batchData, page, isArchived) => {
    try {
      await apiService.post("/report/remittance/", batchData);
      setShowModal(false);
      const data = await loadPage(page, isArchived);
      fetchTabCounts();
      window.dispatchEvent(new Event("remittance-batch-saved"));
      return data;
    } catch (err) {
      console.error("Failed to save batch", err);
      alert("Error saving batch");
      return null;
    }
  };

  const handleArchiveBatch = async (id, page, isArchived) => {
    try {
      await apiService.patch(`/remittance/${id}/`, { is_archived: true });
      const data = await loadPage(page, isArchived);
      fetchTabCounts();
      return data;
    } catch (err) {
      console.error("Failed to archive batch", err);
      setError("Failed to archive remittance batch");
      throw err;
    }
  };

  const handleRestoreBatch = async (id, page, isArchived) => {
    try {
      await apiService.patch(`/remittance/${id}/`, { is_archived: false });
      const data = await loadPage(page, isArchived);
      fetchTabCounts();
      return data;
    } catch (err) {
      console.error("Failed to restore batch", err);
      setError("Failed to restore remittance batch");
      throw err;
    }
  };

  return {
    showModal,
    setShowModal,
    batches,
    meta,
    tabCounts,
    pageSize: PAGE_SIZE,
    loading,
    error,
    loadPage,
    fetchAllBatches,
    handleSaveBatch,
    handleArchiveBatch,
    handleRestoreBatch,
  };
}
