import { useState } from "react";

// Cashier/Treasurer names used before, most recent first, plus which name each
// batch was saved with. Kept in this browser so a name typed once can be picked
// again from the dropdown, and re-exporting an old batch keeps its own name.
const NAMES_KEY = "remittance.cashierNames";
const BY_BATCH_KEY = "remittance.cashierByBatch";
const DEFAULT_CASHIER = "MYLA D. ORTEGA";

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not persisted */ }
}

function loadNames() {
  const names = read(NAMES_KEY, []);
  return Array.isArray(names) && names.length ? names : [DEFAULT_CASHIER];
}

// The name a batch was last saved with — for exporting without opening the form.
export const getBatchCashierName = (batchId) =>
  read(BY_BATCH_KEY, {})[batchId] || DEFAULT_CASHIER;

function remember(name, batchId) {
  const names = [name, ...loadNames().filter((n) => n.toLowerCase() !== name.toLowerCase())];
  write(NAMES_KEY, names);
  if (batchId) write(BY_BATCH_KEY, { ...read(BY_BATCH_KEY, {}), [batchId]: name });
  return names;
}

// name/setName drive the input; save(batchId) records the current name and
// returns it trimmed.
export function useCashierName(batchId) {
  const [names, setNames] = useState(loadNames);
  // An existing batch with no recorded name predates this feature, so it keeps
  // the default; only a new batch starts from the most recently used name.
  const [name, setName] = useState(() =>
    batchId ? read(BY_BATCH_KEY, {})[batchId] || DEFAULT_CASHIER : loadNames()[0]);
  const save = (id = batchId) => {
    const trimmed = name.trim();
    if (trimmed) setNames(remember(trimmed, id));
    return trimmed;
  };
  return { name, setName, names, save };
}
