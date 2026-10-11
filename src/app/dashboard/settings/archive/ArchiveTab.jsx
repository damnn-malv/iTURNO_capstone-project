import React, { useCallback, useEffect, useState } from "react";
import { apiService } from "../../../../lib/api-service";
import { useToast } from "../../../../components/ui/ToastConfirmContext";

const peso = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : "—");

// One entry per archivable record type: where to list it and how to render a row.
const SECTIONS = [
  {
    key: "vehicles",
    label: "Vehicles",
    path: "/vehicles/",
    columns: ["Plate Number", "Route", "Franchise #"],
    cells: (v) => [v.plate_number, v.route_detail?.full_name || "—", v.franchise_number || "—"],
  },
  {
    key: "drivers",
    label: "Drivers",
    path: "/drivers/",
    columns: ["Name", "IWP Number", "Contact"],
    cells: (d) => [
      [d.last_name, d.first_name].filter(Boolean).join(", "),
      d.iwp_number || "—",
      d.contact || "—",
    ],
  },
  {
    key: "series",
    label: "Ticket Series",
    // Fully-used series archive themselves: no flag, just nothing left to issue.
    path: "/ticket-series/",
    listQuery: "",
    filter: (s) => s.remaining <= 0,
    columns: ["Series No.", "Ticket Form", "Date Created"],
    cells: (s) => [s.series_no, s.ticket_form_label || "—", fmtDate(s.created_at)],
  },
  {
    key: "remittance",
    label: "Remittance",
    path: "/report/remittance/",
    columns: ["Batch ID", "Issued At", "Total Amount"],
    cells: (b) => [b.batch_code || b.id, fmtDate(b.issued_at), peso(b.total_amount)],
  },
];

export default function ArchiveTab() {
  const showToast = useToast();
  const [active, setActive] = useState("vehicles");
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        SECTIONS.map(async (s) => {
          const res = await apiService.get(`${s.path}${s.listQuery ?? "?is_archived=true"}`);
          const list = Array.isArray(res) ? res : res.results || [];
          return [s.key, s.filter ? list.filter(s.filter) : list];
        }),
      );
      const next = Object.fromEntries(results);
      setRows(next);
    } catch (err) {
      console.error("Failed to load archive:", err);
      showToast?.("Failed to load archive", "info");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const section = SECTIONS.find((s) => s.key === active);
  const list = rows[active] || [];

  return (
    <>
      <div className="set-tabs" style={{ marginBottom: 12 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className={`set-tab ${active === s.key ? "set-tab-active" : ""}`}
            onClick={() => setActive(s.key)}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="set-table-wrap">
        <table className="set-table">
          <thead>
            <tr>
              {section.columns.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={section.columns.length} className="set-table-state">Loading archive...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={section.columns.length} className="set-table-state">Nothing archived</td></tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="set-row">
                  {section.cells(item).map((cell, i) => (
                    <td key={i} className={i === 0 ? "set-cell-label" : "set-cell-meta"}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
