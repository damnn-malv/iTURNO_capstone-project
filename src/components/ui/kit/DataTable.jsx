import React from "react";
import Spinner from "./Spinner";

const SKELETON_ROWS = 4;
const SKELETON_WIDTHS = ["62%", "42%", "50%", "34%", "56%"];

/**
 * Settings data table.
 *
 * columns:  [{ key, header, align = "left", width, render?: (row) => node }]
 * rows:     array of row objects, rowKey(row) gives a stable key
 * toolbar:  optional node rendered above the table (a Toolbar)
 * footer:   optional node rendered under the table (counts, pagination, hints)
 * loading:  first load. Shows skeleton rows instead of an empty table.
 * rowState: (row) => null | { kind: "busy" | "danger", label }.
 *           A busy row fades and shows a spinner and label in its last cell.
 *           "danger" (archive, delete) also tints the row red until the
 *           server confirms and the row is removed.
 */
function DataTable({ columns, rows, rowKey, emptyMessage = "Nothing here yet", toolbar, footer, loading = false, rowState }) {
  const lastIndex = columns.length - 1;

  return (
    <div className="ui-table-card">
      {toolbar && <div className="ui-table-top">{toolbar}</div>}
      <div className="ui-table-scroll">
        <table className="ui-table" aria-busy={loading || undefined}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`ui-th ui-align-${col.align || "left"}`} style={col.width ? { width: col.width } : undefined}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }, (_, r) => (
                <tr key={`skel-${r}`} className="ui-tr" aria-hidden="true">
                  {columns.map((col, c) => (
                    <td key={col.key} className={`ui-td ui-align-${col.align || "left"}`}>
                      <span className="ui-skel" style={{ width: SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length] }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="ui-empty">{emptyMessage}</td>
              </tr>
            ) : (
              rows.map((row) => {
                const state = rowState?.(row);
                return (
                  <tr key={rowKey(row)} className={`ui-tr${state ? ` ui-tr--${state.kind}` : ""}`}>
                    {columns.map((col, c) => (
                      <td key={col.key} className={`ui-td ui-align-${col.align || "left"}`}>
                        {state && c === lastIndex ? (
                          <span className="ui-row-state" role="status">
                            <Spinner />
                            {state.label}
                          </span>
                        ) : (
                          col.render ? col.render(row) : row[col.key]
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="ui-table-footer">{footer}</div>}
    </div>
  );
}

export default DataTable;
