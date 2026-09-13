import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CreateBatchForm from "./createRemittance";
import ViewRemittance from "./viewRemittance";
import { useRemittance } from "./useRemittance";
import { useToast, useConfirm } from "../../../components/ui/ToastConfirmContext";
import { apiService } from "../../../lib/api-service";
import { getToday, useDebouncedSearchAll } from "../report/reportHook";
import { getPhDateString } from "../../../lib/phDate";
import EodReconciliation from "../report/tables/EodReconciliation";
import Pager from "../report/tables/Pager";
import "../../../styles/Remittance.css";
import "../../../styles/Report.css";

const STATUS_COLOR = {
  OPEN: "rem-status--open",
  CLOSED: "rem-status--closed",
};

const matchesBatch = (b, query) => {
  const q = query.toLowerCase();
  return (
    (b.batch_code || "").toLowerCase().includes(q) ||
    (b.id || "").toString().toLowerCase().includes(q) ||
    (b.issued_by_name || "").toLowerCase().includes(q) ||
    (b.status || "").toLowerCase().includes(q)
  );
};

export default function Remittance() {
  const {
    showModal,
    setShowModal,
    batches,
    meta,
    tabCounts,
    pageSize,
    loading,
    error,
    loadPage,
    fetchAllBatches,
    handleSaveBatch,
    handleArchiveBatch,
    handleRestoreBatch,
  } = useRemittance();

  const showToast = useToast();
  const showConfirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [viewBatch, setViewBatch] = useState(null);
  const [eodDate, setEodDate] = useState(getToday);
  const [eod, setEod] = useState(null);
  const [eodLoading, setEodLoading] = useState(false);
  const [batchTab, setBatchTab] = useState("active");
  const [page, setPage] = useState(1);
  // Bumped after any archive/restore/create so a search already in progress
  // re-fetches its full-record-set instead of showing stale rows.
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const isArchivedTab = batchTab === "archived";

  // Late-remittance flow: lateTargetDate is null for a normal (today) batch,
  // or a past date string when filing for a previously missed day.
  const [lateTargetDate, setLateTargetDate] = useState(null);
  const [showLatePicker, setShowLatePicker] = useState(false);
  const [latePickerDate, setLatePickerDate] = useState(getPhDateString(-1));

  // CreateBatchForm's duplicate-batch and batch-ID-collision checks need the
  // *complete* batch history (both tabs), not just whatever page is on screen —
  // fetched fresh each time the create modal opens.
  const [existingBatchesForCheck, setExistingBatchesForCheck] = useState([]);
  useEffect(() => {
    if (!showModal) return;
    let cancelled = false;
    Promise.all([fetchAllBatches(false), fetchAllBatches(true)])
      .then(([active, archived]) => {
        if (!cancelled) setExistingBatchesForCheck([...active, ...archived]);
      })
      .catch(() => {
        if (!cancelled) setExistingBatchesForCheck([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showModal, fetchAllBatches]);

  // Arriving from the remittance-gap banner (via navigate state) jumps straight
  // into the late-remittance flow, pre-filled with the specific missed date —
  // consumed once, then cleared so a back/refresh doesn't reopen it.
  useEffect(() => {
    if (location.state?.lateDate) {
      setLateTargetDate(location.state.lateDate);
      setShowModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateNewBatch = () => {
    setLateTargetDate(null);
    setShowModal(true);
  };

  const handleStartLateRemittance = () => {
    setLatePickerDate(getPhDateString(-1));
    setShowLatePicker(true);
  };

  const handleConfirmLateDate = () => {
    setLateTargetDate(latePickerDate);
    setShowLatePicker(false);
    setShowModal(true);
  };

  // Page resets to 1 whenever the search term or active tab changes (see the
  // effect below), so this just needs to flip the tab itself.
  const handleTabChange = (tab) => setBatchTab(tab);

  // Once there's an actual query, search the tab's complete record set
  // instead of just the one page currently loaded on screen.
  const fetchAllCurrentTab = useCallback(
    () => fetchAllBatches(isArchivedTab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchAllBatches, isArchivedTab, searchRefreshKey]
  );
  const trimmedSearch = searchTerm.trim();
  const isSearching = trimmedSearch.length > 0;
  const searchResults = useDebouncedSearchAll(fetchAllCurrentTab, searchTerm);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, batchTab]);

  // Server-side page load: fires on first mount and whenever the tab or page
  // changes — skipped while searching, since paging then is purely client-side
  // over the already-fetched full-record-set (see displayedBatches below).
  useEffect(() => {
    if (isSearching) return;
    loadPage(page, isArchivedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isArchivedTab, isSearching]);

  const filteredAll = isSearching && searchResults
    ? searchResults.filter((b) => matchesBatch(b, trimmedSearch))
    : null;
  // While the debounced full-set search is still in flight, fall back to
  // filtering whatever page is already loaded so typing doesn't feel dead.
  const displayedBatches = isSearching
    ? (filteredAll || batches.filter((b) => matchesBatch(b, trimmedSearch))).slice(
        (page - 1) * pageSize,
        page * pageSize
      )
    : batches;
  const displayedCount = isSearching
    ? (filteredAll ? filteredAll.length : displayedBatches.length)
    : meta.count;
  const displayedTotalPages = isSearching
    ? Math.max(Math.ceil(displayedCount / pageSize), 1)
    : meta.totalPages;

  const handlePageChange = (nextPage) => setPage(nextPage);

  const fetchEod = useCallback(async () => {
    setEodLoading(true);
    try {
      const data = await apiService.get(`/report/eod-reconciliation/?date=${eodDate}`);
      setEod(data);
    } catch {
      console.error("Failed to load end-of-day reconciliation");
    } finally {
      setEodLoading(false);
    }
  }, [eodDate]);

  useEffect(() => {
    fetchEod();
  }, [fetchEod]);

  const handleArchiveClick = async (batch) => {
    const ok = await showConfirm(
      `Archive remittance batch #${batch.id}? It will move out of the active list.`
    );
    if (!ok) return;
    try {
      const data = await handleArchiveBatch(batch.id, page, isArchivedTab);
      if (data && data.page !== page) setPage(data.page);
      setSearchRefreshKey((k) => k + 1);
      showToast("Remittance batch archived", "success");
    } catch {
      showToast("Failed to archive remittance batch", "info");
    }
  };

  const handleRestoreClick = async (batch) => {
    try {
      const data = await handleRestoreBatch(batch.id, page, isArchivedTab);
      if (data && data.page !== page) setPage(data.page);
      setSearchRefreshKey((k) => k + 1);
      showToast("Remittance batch restored", "success");
    } catch {
      showToast("Failed to restore remittance batch", "info");
    }
  };

  return (
    <div className="rem-page">
      {/* Header */}
      <div className="rem-header">
        <div className="rem-header-left">
          <div className="rem-header-accent" />
          <div>
            <h1 className="rem-title">Remittance Batches</h1>
            <p className="rem-subtitle">
              Manage remittance collections and deposits
            </p>
          </div>
        </div>
        <div className="rem-header-right">
          <div className="rem-search-wrap">
            <svg className="rem-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="rem-search"
              placeholder="Search by ID, officer, or status… (searches all records)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="rem-add-btn rem-add-btn--secondary" onClick={handleStartLateRemittance}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            File Late Remittance
          </button>
          <button className="rem-add-btn" onClick={handleCreateNewBatch}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Create New Batch
          </button>
        </div>
      </div>

      {showLatePicker && (
        <div className="rem-alert rem-alert--info">
          <span>File a late remittance covering which day?</span>
          <input
            type="date"
            className="rem-input"
            value={latePickerDate}
            max={getPhDateString(-1)}
            onChange={(e) => setLatePickerDate(e.target.value)}
          />
          <button className="rem-btn rem-btn--view" onClick={handleConfirmLateDate}>Continue</button>
          <button className="rem-btn rem-btn--delete" onClick={() => setShowLatePicker(false)}>Cancel</button>
        </div>
      )}

      {error && (
        <div className="rem-alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      <EodReconciliation
        eodDate={eodDate}
        setEodDate={setEodDate}
        eod={eod}
        eodLoading={eodLoading}
      />

      {/* Table card */}
      <div className="rem-card">
        {/* Tab bar */}
        <div className="rem-tabs">
          <button
            type="button"
            className={`rem-tab ${batchTab === "active" ? "rem-tab--active" : ""}`}
            onClick={() => handleTabChange("active")}
          >
            Active
            {tabCounts.active > 0 && (
              <span className="rem-tab-count">{tabCounts.active}</span>
            )}
          </button>
          <button
            type="button"
            className={`rem-tab ${batchTab === "archived" ? "rem-tab--active" : ""}`}
            onClick={() => handleTabChange("archived")}
          >
            Archived
            {tabCounts.archived > 0 && (
              <span className="rem-tab-count">{tabCounts.archived}</span>
            )}
          </button>
        </div>
        <div className="rem-table-wrap">
          <table className="rem-table">
            <thead>
              <tr>
                {["Batch ID", "Issued By", "Issued At", "Total Amount", "Actions"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="rem-table-state">
                    <div className="rem-loading-dots">
                      <div />
                      <div />
                      <div />
                    </div>
                  </td>
                </tr>
              ) : displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan="6" className="rem-table-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>
                      {isSearching
                        ? `No results for "${searchTerm}"`
                        : batchTab === "archived"
                          ? "No archived remittance batches"
                          : "No remittance batches found"}
                    </span>
                  </td>
                </tr>
              ) : (
                displayedBatches.map((b) => (
                  <tr key={b.id} className="rem-row">
                    <td className="rem-td-meta">{b.batch_code || b.id}</td>
                    <td className="rem-td-meta">{b.issued_by_name}</td>
                    <td className="rem-td-meta">
                      {new Date(b.issued_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      {new Date(b.issued_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <span className="rem-amount">
                        ₱{Number(b.total_amount).toLocaleString()}
                      </span>
                    </td>

                    <td>
                      <div className="rem-actions">
                        <button className="rem-btn rem-btn--view" onClick={() => setViewBatch(b)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          View
                        </button>
                        {batchTab === "archived" ? (
                          <button className="rem-btn rem-btn--restore" onClick={() => handleRestoreClick(b)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M3 12a9 9 0 1 0 3-6.7" />
                              <path d="M3 4v5h5" />
                            </svg>
                            Restore
                          </button>
                        ) : (
                          <button className="rem-btn rem-btn--delete" onClick={() => handleArchiveClick(b)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M21 8v13H3V8" />
                              <path d="M1 3h22v5H1z" />
                              <path d="M10 12h4" />
                            </svg>
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          totalPages={displayedTotalPages}
          count={displayedCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Create Modal */}
      {showModal && (
        <CreateBatchForm
          onClose={() => {
            setShowModal(false);
            setLateTargetDate(null);
          }}
          onSave={async (payload) => {
            await handleSaveBatch(payload, page, isArchivedTab);
            setSearchRefreshKey((k) => k + 1);
            setLateTargetDate(null);
          }}
          existingBatches={existingBatchesForCheck}
          targetDate={lateTargetDate}
        />
      )}

      {/* View/Preview Modal */}
      {viewBatch && (
        <ViewRemittance
          batch={viewBatch}
          onClose={() => setViewBatch(null)}
        />
      )}
    </div>
  );
}
