import React, { useEffect, useState } from "react";
import { apiService } from "../../../lib/api-service";
import "../../../styles/Settings.css";

function Settings() {
  const [puvTypes, setPuvTypes] = useState([]);
  const [newType, setNewType] = useState("");

  const [routes, setRoutes] = useState([]);
  const [newOrigin, setNewOrigin] = useState("");

  const [ticketForms, setTicketForms] = useState([]);
  const [newTicketForm, setNewTicketForm] = useState("");

  const [denominations, setDenominations] = useState([]);
  const [newDenomLabel, setNewDenomLabel] = useState("");
  const [newDenomValue, setNewDenomValue] = useState("");
  const [newDenomType, setNewDenomType] = useState("bill");

  useEffect(() => {
    apiService.getPUVTypes()
      .then(setPuvTypes)
      .catch(err => console.error("Failed to load PUV Types:", err));
  }, []);

  const handleAddPUVType = async () => {
    if (!newType.trim()) return;
    try {
      const created = await apiService.createPUVType({ name: newType });
      setPuvTypes([...puvTypes, created]);
      setNewType("");
    } catch (err) {
      console.error("Failed to create:", err);
    }
  };

  useEffect(() => {
    apiService.getRoutes()
      .then(setRoutes)
      .catch(err => console.error("Failed to load routes:", err));
  }, []);

  const handleAddRoute = async () => {
    if (!newOrigin.trim()) return;
    try {
      const created = await apiService.createRoute({ origin: newOrigin });
      setRoutes([...routes, created]);
      setNewOrigin("");
    } catch (err) {
      console.error("Failed to create route:", err);
    }
  };

  const handleDeleteRoute = async (id) => {
    try {
      await apiService.deleteRoute(id);
      setRoutes(routes.filter(r => r.id !== id));
    } catch (err) {
      console.error("Failed to delete route:", err);
    }
  };

  useEffect(() => {
    apiService.getTicketForms()
      .then(setTicketForms)
      .catch(err => console.error("Failed to load ticket forms:", err));
  }, []);

  const handleAddTicketForm = async () => {
    if (!newTicketForm.trim()) return;
    try {
      const created = await apiService.createTicketForm({ name: newTicketForm });
      setTicketForms([...ticketForms, created]);
      setNewTicketForm("");
    } catch (err) {
      console.error("Failed to create ticket form:", err);
    }
  };

  const handleDeleteTicketForm = async (id) => {
    try {
      await apiService.deleteTicketForm(id);
      setTicketForms(ticketForms.filter(t => t.id !== id));
    } catch (err) {
      console.error("Failed to delete ticket form:", err);
    }
  };

  useEffect(() => {
    apiService.getDenominations()
      .then(setDenominations)
      .catch(err => console.error("Failed to load denominations:", err));
  }, []);

  const handleAddDenomination = async () => {
    if (!newDenomLabel.trim() || !newDenomValue) return;
    try {
      const created = await apiService.createDenomination({
        label: newDenomLabel,
        value: parseFloat(newDenomValue),
        type: newDenomType,
      });
      setDenominations([...denominations, created]);
      setNewDenomLabel("");
      setNewDenomValue("");
      setNewDenomType("bill");
    } catch (err) {
      console.error("Failed to create denomination:", err);
    }
  };

  const handleDeleteDenomination = async (id) => {
    try {
      await apiService.deleteDenomination(id);
      setDenominations(denominations.filter(d => d.id !== id));
    } catch (err) {
      console.error("Failed to delete denomination:", err);
    }
  };

  return (
    <div className="set-page">
      {/* Header */}
      <div className="set-header">
        <div className="set-header-left">
          <div className="set-header-accent" />
          <div>
            <h1 className="set-title">Settings</h1>
            <p className="set-subtitle">Manage PUV types, routes, ticket forms, and denominations</p>
          </div>
        </div>
      </div>

      <div className="set-sections">
        {/* PUV Types */}
        <div className="set-card">
          <div className="set-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13" rx="1" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <h2 className="set-card-title">PUV Types</h2>
          </div>
          <div className="set-card-body">
            {puvTypes.length === 0 ? (
              <div className="set-empty">No PUV types configured</div>
            ) : (
              <ul className="set-list">
                {puvTypes.map(pt => (
                  <li key={pt.id} className="set-list-item">
                    <span className="set-item-label">{pt.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="set-add-row">
              <input
                type="text"
                className="set-input"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="New PUV Type"
              />
              <button className="set-add-btn" onClick={handleAddPUVType}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Routes */}
        <div className="set-card">
          <div className="set-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
            </svg>
            <h2 className="set-card-title">Routes</h2>
          </div>
          <div className="set-card-body">
            {routes.length === 0 ? (
              <div className="set-empty">No routes configured</div>
            ) : (
              <ul className="set-list">
                {routes.map(route => (
                  <li key={route.id} className="set-list-item">
                    <span className="set-item-label">{route.full_name}</span>
                    <button className="set-delete-btn" onClick={() => handleDeleteRoute(route.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="set-add-row">
              <input
                type="text"
                className="set-input"
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                placeholder="New Route Origin"
              />
              <button className="set-add-btn" onClick={handleAddRoute}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                Add Route
              </button>
            </div>
          </div>
        </div>

        {/* Ticket Forms */}
        <div className="set-card">
          <div className="set-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <h2 className="set-card-title">Ticket Forms</h2>
          </div>
          <div className="set-card-body">
            {ticketForms.length === 0 ? (
              <div className="set-empty">No ticket forms configured</div>
            ) : (
              <ul className="set-list">
                {ticketForms.map(tf => (
                  <li key={tf.id} className="set-list-item">
                    <span className="set-item-label">{tf.name}</span>
                    <button className="set-delete-btn" onClick={() => handleDeleteTicketForm(tf.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="set-add-row">
              <input
                type="text"
                className="set-input"
                value={newTicketForm}
                onChange={(e) => setNewTicketForm(e.target.value)}
                placeholder="e.g. Cash Ticket @2"
              />
              <button className="set-add-btn" onClick={handleAddTicketForm}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                Add Ticket Form
              </button>
            </div>
          </div>
        </div>

        {/* Denominations */}
        <div className="set-card">
          <div className="set-card-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <h2 className="set-card-title">Denominations (Monetary)</h2>
          </div>
          <div className="set-card-body">
            {denominations.length === 0 ? (
              <div className="set-empty">No denominations configured</div>
            ) : (
              <ul className="set-list">
                {denominations.map(d => (
                  <li key={d.id} className="set-list-item">
                    <div>
                      <span className="set-item-label">{d.label}</span>
                      <span className="set-item-meta">₱{d.value}</span>
                      <span className="set-denom-badge">{d.type}</span>
                    </div>
                    <button className="set-delete-btn" onClick={() => handleDeleteDenomination(d.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="set-add-row">
              <input
                type="text"
                className="set-input"
                value={newDenomLabel}
                onChange={(e) => setNewDenomLabel(e.target.value)}
                placeholder="Label (e.g. 1000 Peso Bill)"
              />
              <input
                type="number"
                className="set-input"
                value={newDenomValue}
                onChange={(e) => setNewDenomValue(e.target.value)}
                placeholder="Value"
                style={{ maxWidth: 120 }}
              />
              <select className="set-select" value={newDenomType} onChange={(e) => setNewDenomType(e.target.value)}>
                <option value="bill">Bill</option>
                <option value="coin">Coin</option>
              </select>
              <button className="set-add-btn" onClick={handleAddDenomination}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
