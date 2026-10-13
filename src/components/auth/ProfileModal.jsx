import React, { useState } from "react";
import { apiService } from "../../lib/api-service";
import { useFeedback } from "../ui/kit";
import { focusFirstError } from "../../lib/focusFirstError";
import "../../styles/FormModal.css";

const capitalizeWords = (value) => value.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

const Field = ({ label, required, optional, error, hint, children }) => (
  <div className="usr-field">
    <label className="usr-label">
      {label}
      {required && <span className="usr-required"> *</span>}
      {optional && <span className="usr-optional"> (optional)</span>}
    </label>
    {children}
    {error ? <p className="usr-field-error">{error}</p> : hint && <p className="usr-field-hint">{hint}</p>}
  </div>
);

// Self-service profile editor: name and contact number only. Email, password and
// role are intentionally not editable here (the server enforces the same limit).
function ProfileModal({ user, onSaved, onClose }) {
  const { notify } = useFeedback();
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    middle_name: user.middle_name || "",
    last_name: user.last_name || "",
    contact: user.contact || "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const next = {};
    if (!form.first_name.trim()) next.first_name = "Enter your first name.";
    if (!form.last_name.trim()) next.last_name = "Enter your last name.";
    if (form.contact && !/^\d{11}$/.test(form.contact)) next.contact = "Contact number must be 11 digits.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(".usr-modal");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiService.updateCurrentUser(form);
      onSaved(updated);
      window.dispatchEvent(new Event("profile-updated"));
      notify.success({ title: "Profile updated" });
      onClose();
    } catch (err) {
      setErrors({ form: err.message || "Could not update your profile." });
      setSaving(false);
    }
  };

  const cls = (key) => `usr-input${errors[key] ? " usr-input--error" : ""}`;

  return (
    <div className="usr-overlay" onClick={onClose}>
      <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="usr-modal-header">
          <h2 className="usr-modal-title">My profile</h2>
          <button className="usr-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="usr-modal-body">
          <div className="usr-form-grid">
            <Field label="First name" required error={errors.first_name}>
              <input type="text" className={cls("first_name")} value={form.first_name} onChange={(e) => set("first_name", capitalizeWords(e.target.value))} />
            </Field>
            <Field label="Last name" required error={errors.last_name}>
              <input type="text" className={cls("last_name")} value={form.last_name} onChange={(e) => set("last_name", capitalizeWords(e.target.value))} />
            </Field>
            <Field label="Middle name" optional>
              <input type="text" className="usr-input" value={form.middle_name} onChange={(e) => set("middle_name", capitalizeWords(e.target.value))} />
            </Field>
            <Field label="Contact number" optional error={errors.contact}>
              <input type="text" inputMode="numeric" maxLength={11} className={cls("contact")} placeholder="e.g. 09XXXXXXXXX" value={form.contact} onChange={(e) => set("contact", e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>

          <Field label="Email address" hint="Your email and password can't be changed here. Ask an Admin if your email needs to change.">
            <input type="text" className="usr-input" value={user.username || ""} disabled />
          </Field>

          {errors.form && <p className="usr-field-error">{errors.form}</p>}

          <div className="usr-modal-footer">
            <button type="button" className="usr-modal-btn usr-modal-btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="usr-modal-btn usr-modal-btn--submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileModal;
