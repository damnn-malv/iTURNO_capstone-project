import { DataTable } from "../../../components/ui/dataTable";

export default function DriverRecords({
  driversTotal,
  showAllDrivers,
  setShowAllDrivers,
  visibleDrivers,
  handleExportDriversCSV,
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
  btnExport,
  btnSecondary,
}) {
  return (
    <div className="rpt-card rpt-section">
      <div className="rpt-card-header">
        <div className="rpt-card-header-left">
          <span className="rpt-card-title">Driver Records</span>
          <span className="rpt-record-count">
            {showAllDrivers ? driversTotal : Math.min(5, driversTotal)} of {driversTotal} records
          </span>
        </div>
        <div className="rpt-card-header-actions">
          {driversTotal > 5 && (
            <button className="rpt-btn rpt-btn--secondary" onClick={() => setShowAllDrivers((v) => !v)}>
              {showAllDrivers ? "Show Less" : "View All"}
            </button>
          )}
          <button className="rpt-btn-export rpt-btn-export--green" onClick={handleExportDriversCSV}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <DataTable
        columns={["IWP Number", "Name", "Contact Number"]}
        data={visibleDrivers}
        rowRenderer={(d, idx, { rowClass, cellClass }) => (
          <tr key={d.id} className={rowClass}>
            <td className={`${cellClass} rpt-mono`}>{d.iwp_number || d.id}</td>
            <td className={`${cellClass} rpt-bold`}>{d.name}</td>
            <td className={cellClass}>{d.contact}</td>
          </tr>
        )}
      />
    </div>
  );
}
