import React from "react";
import {
  DataTable, Toolbar, SearchInput, IconButton, SectionHeader, PrimaryButton, ArchiveIcon, InfoIcon, AlertIcon,
} from "../../../components/ui/kit";

// Presentational only: data, drafts, search state and handlers come from settings.jsx.
function PuvTypesSection({
  puvTypes, loading, rowStates, search, onSearch, onAdd, priceInputs, onPriceChange, onSavePrice, onRevertPrice, onArchive,
}) {
  const q = search.trim().toLowerCase();
  const rows = puvTypes.filter((pt) => !q || pt.name?.toLowerCase().includes(q));

  const columns = [
    { key: "name", header: "Type", render: (pt) => <span className="ui-cell-strong">{pt.name}</span> },
    {
      key: "fee",
      header: "Terminal fee",
      render: (pt) => {
        const draft = priceInputs[pt.id];
        const dirty = draft !== undefined;
        const working = !!rowStates[pt.id];
        const value = draft ?? pt.terminal_price ?? "";
        const noFee = !(parseFloat(value) > 0);
        return (
          <div className="ui-fee-field">
            <span className="ui-fee-input">
              <span className="ui-fee-prefix">₱</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => onPriceChange(pt.id, e.target.value)}
                aria-label={`Terminal fee for ${pt.name}`}
              />
            </span>
            {noFee && (
              <span className="ui-fee-warning"><AlertIcon /> No fee set</span>
            )}
            {dirty && (
              <>
                <button type="button" className="ui-text-btn" onClick={() => onSavePrice(pt)} disabled={working}>
                  Save
                </button>
                <button type="button" className="ui-text-btn ui-text-btn--ghost" onClick={() => onRevertPrice(pt.id)} disabled={working}>
                  Revert
                </button>
              </>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (pt) => (
        <div className="ui-cell-actions">
          <IconButton icon={<ArchiveIcon />} text="Archive" label={`Archive ${pt.name}`} onClick={() => onArchive(pt)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <SectionHeader
        title="PUV types"
        action={<PrimaryButton onClick={onAdd}>Add PUV type</PrimaryButton>}
      />
      <DataTable
        toolbar={
          <Toolbar>
            <SearchInput value={search} onChange={onSearch} placeholder="Search PUV types" />
          </Toolbar>
        }
        columns={columns}
        rows={rows}
        loading={loading}
        rowState={(pt) => rowStates[pt.id]}
        rowKey={(pt) => pt.id}
        emptyMessage={puvTypes.length === 0 ? "No PUV types configured" : "No matches found"}
        footer={
          <span className="ui-footer-hint"><InfoIcon /> Edit a fee directly in the table, then save that row. Archived types are in Records &rarr; Archive.</span>
        }
      />
    </>
  );
}

export default PuvTypesSection;
