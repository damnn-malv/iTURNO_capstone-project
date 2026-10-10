import { exportTablePDF } from "../report/exportPDF";
import { getDriverCode } from "../driver/driver-utils";

const buildVehicleRow = (v) => ({
  "Plate Number": v.plate_number,
  Route: v.route_detail ? `${v.route_detail.origin} - San Fernando` : v.route || "—",
  Transportation: v.transportation_name || v.transportation_id || "—",
  "Franchise #": v.franchise_number || "—",
  "Franchise Expiration": v.franchise_expiration_date || "—",
  "QR Code": v.qr_code || "—",
  "Active Driver": v.active_driver_name || "Unassigned",
});

const buildDriverRow = (d) => ({
  IWP: getDriverCode(d),
  "IWP Expiration": d.iwp_expiration_date || "—",
  "First Name": d.first_name || "—",
  "Middle Name": d.middle_name || "—",
  "Last Name": d.last_name || "—",
  Gender: d.gender || "—",
  Birthdate: d.birthdate || "—",
  Province: d.province || "—",
  City: d.city || "—",
  Barangay: d.barangay || "—",
  Street: d.street || "—",
  "Contact No.": d.contact || "—",
});

export const exportVehiclesPDF = (vehicles) =>
  exportTablePDF(vehicles.map(buildVehicleRow), "Vehicle Records");

export const exportDriversPDF = (drivers) =>
  exportTablePDF(drivers.map(buildDriverRow), "Driver Records");
