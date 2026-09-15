// Plain-English field names, shared by the CSV template/column guide and the
// manual-entry form's submitted payload — both funnel through the same
// backend resolver (backend/api/views/backfill.py), which expects these
// exact keys. Keep the two files' constants in sync if either changes.
//
// There's no Driver, Route, or Amount field — driver/route are always taken
// from the vehicle itself (Vehicle.owner_driver / Vehicle.route), and price is
// always the Ticket Type's price. F_TICKET_ID is only used by Single Entry's
// "I have the exact ticket number" advanced fallback; CSV never sends it.
export const F_TICKET_ID = "Ticket Number";
export const F_PLATE = "Vehicle Plate Number";
export const F_TICKET_TYPE = "Ticket Type";
export const F_QUANTITY = "Ticket Amount";
export const F_ISSUED_AT = "Date and Time Issued";
export const F_STAFF_EMAIL = "Staff Email";
export const F_MODE = "Mode";
export const F_NOTES = "Notes";
