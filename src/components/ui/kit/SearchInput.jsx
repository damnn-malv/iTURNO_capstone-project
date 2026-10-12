import React from "react";
import { SearchIcon } from "./icons";

function SearchInput({ value, onChange, placeholder = "Search", label, className = "" }) {
  return (
    <label className={`ui-search ${className}`.trim()}>
      <span className="ui-search-icon"><SearchIcon /></span>
      <input
        type="search"
        className="ui-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
      />
    </label>
  );
}

export default SearchInput;
