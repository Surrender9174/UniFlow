"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import {
  defaultProfile,
  getNotificationSnapshot,
  getServerNotificationSnapshot,
  getServerProfileSnapshot,
  getStoredProfileSnapshot,
  saveNotificationPreference,
  saveProfile,
  subscribeToPreferences,
  subscribeToProfile,
  type StudentProfile,
} from "@/lib/profile";

export default function ProfilePage() {
  const savedProfile = useSyncExternalStore(
    subscribeToProfile,
    getStoredProfileSnapshot,
    getServerProfileSnapshot,
  );
  const savedNotifications = useSyncExternalStore(
    subscribeToPreferences,
    getNotificationSnapshot,
    getServerNotificationSnapshot,
  );
  const persistedProfile = savedProfile
    ? { ...defaultProfile, ...JSON.parse(savedProfile) as Partial<StudentProfile> }
    : defaultProfile;
  const [draft, setDraft] = useState<StudentProfile | null>(null);
  const profile = draft ?? persistedProfile;
  const [saved, setSaved] = useState(false);
  const notifications = savedNotifications === "on";

  const updateField = (field: keyof StudentProfile, value: string) => {
    setDraft((current) => ({ ...(current ?? profile), [field]: value }));
    setSaved(false);
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveProfile(profile);
    setDraft(null);
    setSaved(true);
  };

  const toggleNotifications = () => {
    saveNotificationPreference(!notifications);
  };

  return (
    <div className="section-page profile-page">
      <div className="page-heading">
        <div><p className="eyebrow">CONTUL TĂU</p><h1>Profilul meu</h1><p className="muted">Personalizează-ți spațiul UniFlow.</p></div>
      </div>
      <div className="profile-layout">
        <aside className="profile-card card-surface">
          <div className="profile-avatar">{profile.name.trim().slice(0, 1).toUpperCase() || "A"}<span aria-hidden="true" className="avatar-edit"><Icon name="plus" size={14} /></span></div>
          <h2>{profile.name || "Numele tău"}</h2><p>{profile.program} · {profile.year}</p>
          <span className="student-badge"><Icon name="graduation" size={15} /> Student UniFlow</span>
          <div className="profile-card-divider" />
          <div className="profile-detail"><Icon name="mail" size={16} /><span>{profile.email}</span></div>
          <div className="profile-detail"><Icon name="map" size={16} /><span>{profile.university}</span></div>
          <div className="profile-streak"><span>✦</span><div><strong>7 zile la rând</strong><small>Ai grijă de progresul tău!</small></div></div>
        </aside>
        <div className="profile-settings">
          <form className="card-surface settings-card" onSubmit={handleSave}>
            <div className="settings-title"><span className="settings-icon"><Icon name="user" size={18} /></span><div><h2>Informații personale</h2><p>Aceste detalii te ajută să-ți organizezi semestrul.</p></div></div>
            <div className="form-grid">
              <label className="form-field"><span>Nume complet</span><input onChange={(event) => updateField("name", event.target.value)} required value={profile.name} /></label>
              <label className="form-field"><span>Adresă de email</span><input onChange={(event) => updateField("email", event.target.value)} required type="email" value={profile.email} /></label>
              <label className="form-field"><span>Universitate</span><input onChange={(event) => updateField("university", event.target.value)} required value={profile.university} /></label>
              <label className="form-field"><span>Program de studiu</span><input onChange={(event) => updateField("program", event.target.value)} required value={profile.program} /></label>
              <label className="form-field"><span>An de studiu</span><select onChange={(event) => updateField("year", event.target.value)} value={profile.year}><option>Anul I</option><option>Anul II</option><option>Anul III</option><option>Master</option><option>Doctorat</option></select></label>
            </div>
            <div className="form-footer"><span className="save-feedback" role="status">{saved ? "Modificările au fost salvate." : ""}</span><button className="button button-primary" type="submit">Salvează modificările</button></div>
          </form>
          <section className="card-surface preferences-card">
            <div className="settings-title"><span className="settings-icon settings-icon-muted"><Icon name="bell" size={18} /></span><div><h2>Preferințe</h2><p>Controlează cum te ține UniFlow la curent.</p></div></div>
            <div className="preference-row"><div><strong>Notificări pentru deadline-uri</strong><small>Primești un reminder înainte de fiecare termen.</small></div><button aria-checked={notifications} aria-label="Notificări pentru deadline-uri" className={`toggle-switch${notifications ? " on" : ""}`} onClick={toggleNotifications} role="switch" type="button"><span /></button></div>
          </section>
          <section className="card-surface preferences-card">
            <div className="settings-title"><span className="settings-icon settings-icon-muted"><Icon name="sun" size={18} /></span><div><h2>Aparență</h2><p>Setarea temei pentru spațiul tău.</p></div></div>
            <div className="theme-options"><button className="theme-option selected" type="button"><span className="theme-preview theme-light" />Luminos <span className="theme-selected">✓</span></button><button className="theme-option" disabled type="button"><span className="theme-preview theme-dark" />Întunecat <small>În curând</small></button></div>
          </section>
        </div>
      </div>
    </div>
  );
}
