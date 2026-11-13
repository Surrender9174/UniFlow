"use client";

import { useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { extractScheduleFile, isSupportedScheduleFile } from "@/lib/schedule-file-reader";
import { parseScheduleText } from "@/lib/schedule-parser";
import {
  clearSchedule,
  getServerScheduleSnapshot,
  getStoredScheduleSnapshot,
  parseScheduleSnapshot,
  saveSchedule,
  subscribeToSchedule,
} from "@/lib/schedule-storage";
import {
  defaultProfile,
  getNotificationSnapshot,
  getServerNotificationSnapshot,
  getServerProfileSnapshot,
  getServerThemeSnapshot,
  getThemeSnapshot,
  getStoredProfileSnapshot,
  saveNotificationPreference,
  saveProfile,
  saveThemePreference,
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
  const savedTheme = useSyncExternalStore(
    subscribeToPreferences,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const savedSchedule = useSyncExternalStore(
    subscribeToSchedule,
    getStoredScheduleSnapshot,
    getServerScheduleSnapshot,
  );
  const persistedProfile = savedProfile
    ? { ...defaultProfile, ...JSON.parse(savedProfile) as Partial<StudentProfile> }
    : defaultProfile;
  const [draft, setDraft] = useState<StudentProfile | null>(null);
  const profile = draft ?? persistedProfile;
  const hasSchedule =
    !!profile.schedule.trim() || parseScheduleSnapshot(savedSchedule).length > 0;
  const [saved, setSaved] = useState(false);
  const [scheduleFileName, setScheduleFileName] = useState("");
  const [scheduleFileError, setScheduleFileError] = useState("");
  const [scheduleFileProgress, setScheduleFileProgress] = useState("");
  const [scheduleFileProcessing, setScheduleFileProcessing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const notifications = savedNotifications === "on";

  const updateField = <K extends keyof StudentProfile>(
    field: K,
    value: StudentProfile[K],
  ) => {
    setDraft((current) => ({ ...(current ?? profile), [field]: value }));
    setSaved(false);
    setSaveError("");
  };

  const handleScheduleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setScheduleFileError("");
    setScheduleFileProgress("");
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setScheduleFileError("Fișierul depășește limita de 15 MB.");
      input.value = "";
      return;
    }

    if (!isSupportedScheduleFile(file)) {
      setScheduleFileError("Alege un PDF, o imagine, un fișier Excel, Word, CSV sau TXT.");
      input.value = "";
      return;
    }

    setScheduleFileName(file.name);
    setScheduleFileProcessing(true);
    setScheduleFileProgress("Se citește orarul...");
    try {
      const text = await extractScheduleFile(file, setScheduleFileProgress);
      if (!parseScheduleText(text).length) {
        throw new Error("Nu am putut identifica zile, ore și cursuri în fișier.");
      }
      updateField("schedule", text);
      setScheduleFileProgress("Orarul a fost extras. Poți verifica sau edita textul.");
    } catch (error) {
      setScheduleFileName("");
      setScheduleFileProgress("");
      setScheduleFileError(
        error instanceof Error ? error.message : "Nu am putut procesa fișierul. Încearcă din nou.",
      );
      input.value = "";
    } finally {
      setScheduleFileProcessing(false);
    }
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError("");
    if (scheduleFileProcessing) {
      setSaveError("Așteaptă terminarea procesării orarului.");
      return;
    }
    const scheduleEvents = profile.schedule.trim() ? parseScheduleText(profile.schedule) : [];
    if (profile.schedule.trim() && !scheduleEvents.length) {
      setSaveError("Nu am putut identifica zile, ore și cursuri în orar.");
      return;
    }
    saveProfile(profile);
    if (scheduleEvents.length) {
      saveSchedule(scheduleEvents);
    } else if (persistedProfile.schedule.trim()) {
      clearSchedule();
    }
    setDraft(null);
    setSaved(true);
  };

  const toggleNotifications = () => {
    saveNotificationPreference(!notifications);
  };

  const toggleTheme = () => {
    saveThemePreference(savedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="section-page profile-page">
      <div className="page-heading">
        <div><p className="eyebrow">CONTUL TĂU</p><h1>Profilul meu</h1><p className="muted">Personalizează-ți spațiul UniFlow.</p></div>
      </div>
      <div className="profile-layout">
        <aside className="profile-card card-surface">
          <div className="profile-avatar">{profile.name.trim().slice(0, 1).toUpperCase() || "A"}<span aria-hidden="true" className="avatar-edit"></span></div>
          <h2>{profile.name || "Numele tău"}</h2><p>{profile.program} · {profile.year} · {profile.semester}</p>
          <span className="student-badge"><Icon name="graduation" size={15} /> {profile.institutionType === "university" ? "Student UniFlow" : "Elev UniFlow"}</span>
          <div className="profile-card-divider" />
          <div className="profile-detail"><Icon name="mail" size={16} /><span>{profile.email}</span></div>
          <div className="profile-detail"><Icon name="map" size={16} /><span>{profile.university}</span></div>
          <div className="profile-detail"><Icon name="calendar" size={16} /><span>{hasSchedule ? "Completat" : "Necompletat"}</span></div>
          <div className="profile-streak"><span>✦</span><div><strong>7 zile la rând</strong><small>Ai grijă de progresul tău!</small></div></div>
        </aside>
        <div className="profile-settings">
          <form className="card-surface settings-card" onSubmit={handleSave}>
            <div className="settings-title"><span className="settings-icon"><Icon name="user" size={18} /></span><div><h2>Informații personale</h2><p>Aceste detalii te ajută să-ți organizezi semestrul.</p></div></div>
            <div className="form-grid">
              <label className="form-field"><span>Nume complet</span><input onChange={(event) => updateField("name", event.target.value)} required value={profile.name} /></label>
              <label className="form-field"><span>Adresă de email</span><input onChange={(event) => updateField("email", event.target.value)} required type="email" value={profile.email} /></label>
              <label className="form-field"><span>Tipul instituției</span><select onChange={(event) => { const type = event.target.value === "high-school" ? "high-school" : "university"; updateField("institutionType", type); updateField("year", type === "university" ? "Anul I" : "Clasa a IX-a"); }} value={profile.institutionType}><option value="university">Universitate</option><option value="high-school">Liceu</option></select></label>
              <label className="form-field"><span>{profile.institutionType === "university" ? "Universitate" : "Liceu"}</span><input onChange={(event) => updateField("university", event.target.value)} required value={profile.university} /></label>
              <label className="form-field"><span>{profile.institutionType === "university" ? "Specializare" : "Profil"}</span><input onChange={(event) => updateField("program", event.target.value)} required value={profile.program} /></label>
              <label className="form-field"><span>{profile.institutionType === "university" ? "An de studiu" : "Clasa"}</span><select onChange={(event) => updateField("year", event.target.value)} required value={profile.year}>{(profile.institutionType === "university" ? ["Anul I", "Anul II", "Anul III", "Anul IV", "Master I", "Master II", "Doctorat"] : ["Clasa a IX-a", "Clasa a X-a", "Clasa a XI-a", "Clasa a XII-a"]).map((studyYear) => <option key={studyYear}>{studyYear}</option>)}</select></label>
              <label className="form-field"><span>Semestru</span><select onChange={(event) => updateField("semester", event.target.value)} required value={profile.semester}><option>Semestrul I</option><option>Semestrul II</option></select></label>
              <div className="form-field form-field-wide">
                <span>Orar (opțional)</span>
                <label className={`auth-file-picker${scheduleFileName ? " selected" : ""}`}>
                  <Icon name="upload" size={16} />
                  {scheduleFileProcessing
                    ? scheduleFileProgress || "Se procesează orarul..."
                    : scheduleFileName || "Upload File (Ex. PDF, JPG, IMG)"}
                  <input
                    accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.xlsm,.docx,.doc,.csv,.txt"
                    aria-label="Selectează un orar PDF, imagine sau document"
                    className="visually-hidden"
                    disabled={scheduleFileProcessing}
                    onChange={handleScheduleFileChange}
                    type="file"
                  />
                </label>
                {scheduleFileError && <small className="auth-message error" role="alert">{scheduleFileError}</small>}
                {!scheduleFileError && scheduleFileProgress && !scheduleFileProcessing && (
                  <small className="muted" role="status">{scheduleFileProgress}</small>
                )}
                <label className="auth-field">
                  <textarea
                    className="auth-schedule-textarea"
                    onChange={(event) => updateField("schedule", event.target.value)}
                    placeholder="Text Simplu"
                    rows={2}
                    value={profile.schedule}
                  />
                </label>
              </div>
            </div>
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            <div className="form-footer"><span className="save-feedback" role="status">{saved ? "Modificările au fost salvate." : ""}</span><button className="button button-primary" disabled={scheduleFileProcessing} type="submit">Salvează modificările</button></div>
          </form>
          <section className="card-surface preferences-card">
            <div className="settings-title"><span className="settings-icon settings-icon-muted"><Icon name="bell" size={18} /></span><div><h2>Preferințe</h2><p>Controlează cum te ține UniFlow la curent.</p></div></div>
            <div className="preference-row"><div><strong>Notificări pentru deadline-uri</strong><small>Primești un reminder înainte de fiecare termen.</small></div><button aria-checked={notifications} aria-label="Notificări pentru deadline-uri" className={`toggle-switch${notifications ? " on" : ""}`} onClick={toggleNotifications} role="switch" type="button"><span /></button></div>
          </section>
          
        </div>
      </div>
    </div>
  );
}
