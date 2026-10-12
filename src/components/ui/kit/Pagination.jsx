import React from "react";

function Pagination({ page, pageCount, onPage }) {
  return (
    <div className="ui-pager">
      <button type="button" className="ui-pager-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <button type="button" className="ui-pager-btn" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export default Pagination;
