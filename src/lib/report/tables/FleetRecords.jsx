import { DataTable } from "../../../components/ui/dataTable";
import { useState } from "react";
import ReportTableModal from "./ReportTableModal";

const VEHICLE_COLUMNS = ["Vehicle Code", "Plate Number", "Route", "Driver"];
const DRIVER_COLUMNS = ["IWP Number", "Name", "Contact Number"];

export default function FleetRecords({
  vehiclesTotal,
  showAllVehicles,
  setShowAllVehicles,
  visibleVehicles,
  handleExportVehiclesCSV,

  driversTotal,
  showAllDrivers,
  setShowAllDrivers,
  visibleDrivers,
  handleExportDriversCSV,
}) {
  const [activeTab, setActiveTab] = useState("vehicles");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const isVehicles = activeTab === "vehicles";

  const searchedVehicles = visibleVehicles.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const route = v.route_detail ? `${v.route_detail.origin} - San Fernando` : v.route || "";
    return [v.code, v.plate_number, route, v.active_driver_name]
      .some((val) => val && val.toLowerCase().includes(q));
  });

  const searchedDrivers = visibleDrivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [d.iwp_number || String(d.id), d.name, d.contact]
      .some((val) => val && String(val).toLowerCase().includes(q));
  });

  const searched = isVehicles ? searchedVehicles : searchedDrivers;
  const showAll = isVehicles ? showAllVehicles : showAllDrivers;
  const total = isVehicles ? vehiclesTotal : driversTotal;
  const preview = showAll ? searched.slice(0, 5) : searched;

  const renderVehicleRow = (v, idx, { rowClass, cellClass }) => (
    <tr key={v.code} className={rowClass}>
      <td className={`${cellClass} rpt-mono`}>{v.code}</td>
      <td className={cellClass}>
        <span className="rpt-plate">{v.plate_number}</span>
      </td>
      <td className={cellClass}>
        {v.route_detail ? `${v.route_detail.origin} - San Fernando` : v.route}
      </td>
      <td className={cellClass}>
        {v.active_driver_name || <span className="rpt-na">Unassigned</span>}
      </td>
    </tr>
  );

  const renderDriverRow = (d, idx, { rowClass, cellClass }) => (
    <tr key={d.id} className={rowClass}>
      <td className={`${cellClass} rpt-mono`}>{d.iwp_number || d.id}</td>
      <td className={`${cellClass} rpt-bold`}>{d.name}</td>
      <td className={cellClass}>{d.contact}</td>
    </tr>
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setShowModal(false);
  };

  const handleViewAll = () => {
    if (isVehicles) setShowAllVehicles(true);
    else setShowAllDrivers(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (isVehicles) setShowAllVehicles(false);
    else setShowAllDrivers(false);
  };

  return (
    <div className="rpt-card rpt-section">
      <div className="rpt-card-header">
        <div className="rpt-card-header-left">
          <div className="rpt-tab-group">
            <button
              className={`rpt-tab ${isVehicles ? "rpt-tab--active" : ""}`}
              onClick={() => handleTabChange("vehicles")}
            >
              Vehicle Records
            </button>
            <button
              className={`rpt-tab ${!isVehicles ? "rpt-tab--active" : ""}`}
              onClick={() => handleTabChange("drivers")}
            >
              Driver Records
            </button>
          </div>
          <span className="rpt-record-count">
            {preview.length} of {total} records
          </span>
        </div>
        <div className="rpt-card-header-actions">
          <input
            type="text"
            className="rpt-search-input"
            placeholder={isVehicles ? "Search vehicles…" : "Search drivers…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {total > 5 && (
            <button className="rpt-btn rpt-btn--secondary" onClick={handleViewAll}>
              View All
            </button>
          )}
          <button
            className="rpt-btn-export rpt-btn-export--green"
            onClick={isVehicles ? handleExportVehiclesCSV : handleExportDriversCSV}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {isVehicles ? (
        <DataTable columns={VEHICLE_COLUMNS} data={preview} rowRenderer={renderVehicleRow} />
      ) : (
        <DataTable columns={DRIVER_COLUMNS} data={preview} rowRenderer={renderDriverRow} />
      )}

      {showModal && (
        <ReportTableModal
          title={isVehicles ? "Vehicle Records" : "Driver Records"}
          subtitle={isVehicles ? "Complete registered vehicle fleet" : "Complete registered driver roster"}
          count={searched.length}
          onClose={handleCloseModal}
        >
          {isVehicles ? (
            <DataTable columns={VEHICLE_COLUMNS} data={searched} rowRenderer={renderVehicleRow} />
          ) : (
            <DataTable columns={DRIVER_COLUMNS} data={searched} rowRenderer={renderDriverRow} />
          )}
        </ReportTableModal>
      )}
    </div>
  );
}
