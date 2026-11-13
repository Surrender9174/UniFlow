"use client";


import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { extractScheduleFile, isSupportedScheduleFile } from "@/lib/schedule-file-reader";
import { parseScheduleText } from "@/lib/schedule-parser";
import { scheduleFileAccept, maxScheduleFileSize } from "@/lib/schedule-file-types";
import {
  getServerScheduleSnapshot,
  getStoredScheduleSnapshot,
  parseScheduleSnapshot,
  subscribeToSchedule,
} from "@/lib/schedule-storage";
import { saveStudentProfileToDatabase } from "@/lib/auth-profile";
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
  const router = useRouter();
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [scheduleFileName, setScheduleFileName] = useState("");
  const [scheduleFileError, setScheduleFileError] = useState("");
  const [scheduleFileProgress, setScheduleFileProgress] = useState("");
  const [scheduleFileProcessing, setScheduleFileProcessing] = useState(false);
  const notifications = savedNotifications === "on";

  const handleScheduleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setScheduleFileError("");
    setScheduleFileProgress("");
    if (!file) {
      setScheduleFileName("");
      return;
    }

    if (file.size > maxScheduleFileSize) {
      setScheduleFileName("");
      setScheduleFileError("Fișierul depășește limita de 15 MB.");
      input.value = "";
      return;
    }

    if (!isSupportedScheduleFile(file)) {
      setScheduleFileName("");
      setScheduleFileError("Alege un PDF, o imagine PNG/JPG/WebP, un fișier Excel, Word, CSV sau TXT.");
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
      setDraft((current) => ({ ...(current ?? profile), schedule: text }));
      setSaved(false);
      setSaveError("");
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

  const updateField = <K extends keyof StudentProfile>(
    field: K,
    value: StudentProfile[K],
  ) => {
    setDraft((current) => ({ ...(current ?? profile), [field]: value }));
    setSaved(false);
    setSaveError("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      await saveStudentProfileToDatabase(profile);
      saveProfile(profile);
      setDraft(null);
      setSaved(true);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Nu am putut salva profilul.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifications = () => {
    saveNotificationPreference(!notifications);
  };

  const handleLogout = async () => {
    if (!supabase) {
      setSignOutError("Autentificarea nu este disponibilă.");
      return;
    }

    setSigningOut(true);
    setSignOutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/auth");
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Nu te-ai putut deconecta.",
      );
    } finally {
      setSigningOut(false);
    }
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
          <span className="student-badge"><Icon name="graduation" size={15} /> {profile.institutionType === "Universitate" ? "Student UniFlow" : "Elev UniFlow"}</span>
          <div className="profile-card-divider" />
          <div className="profile-detail"><Icon name="mail" size={16} /><span>{profile.email}</span></div>
          <div className="profile-detail"><Icon name="map" size={16} /><span>{profile.university}</span></div>
          <div className="profile-detail"><Icon name="calendar" size={16} /><span>{hasSchedule ? "Completat" : "Necompletat"}</span></div>
          <div className="profile-streak"><span>✦</span><div><strong>7 zile la rând</strong><small>Ai grijă de progresul tău!</small></div></div>
          <div className="profile-account-actions">
            <button
              className="button button-secondary"
              disabled={signingOut}
              onClick={handleLogout}
              type="button"
            >
              {signingOut ? "Se deconectează..." : "Deconectare"}
            </button>
            {signOutError && <p className="profile-logout-error" role="alert">{signOutError}</p>}
          </div>
        </aside>
        <div className="profile-settings">
          <form className="card-surface settings-card" onSubmit={handleSave}>
            <div className="settings-title"><span className="settings-icon"><Icon name="user" size={18} /></span><div><h2>Informații personale</h2><p>Datele academice se salvează în baza de date; emailul și orarul se păstrează în acest browser.</p></div></div>
            <div className="form-grid">
              <label className="form-field"><span>Nume complet</span><input onChange={(event) => updateField("name", event.target.value)} required value={profile.name} /></label>
              <label className="form-field"><span>Adresă de email</span><input onChange={(event) => updateField("email", event.target.value)} required type="email" value={profile.email} /></label>
              <label className="form-field"><span>Tipul instituției</span><select onChange={(event) => { const type = event.target.value === "Liceu" ? "Liceu" : "Universitate"; updateField("institutionType", type); updateField("year", type === "Universitate" ? "Anul I" : "Clasa a IX-a"); }} value={profile.institutionType}><option value="Universitate">Universitate</option><option value="Liceu">Liceu</option></select></label>
              <label className="form-field"><span>{profile.institutionType === "Universitate" ? "Universitate" : "Liceu"}</span><input onChange={(event) => updateField("university", event.target.value)} required value={profile.university} /></label>
              <label className="form-field"><span>{profile.institutionType === "Universitate" ? "Specializare" : "Profil"}</span><input onChange={(event) => updateField("program", event.target.value)} required value={profile.program} /></label>
              <label className="form-field"><span>{profile.institutionType === "Universitate" ? "An de studiu" : "Clasa"}</span><select onChange={(event) => updateField("year", event.target.value)} required value={profile.year}>{(profile.institutionType === "Universitate" ? ["Anul I", "Anul II", "Anul III", "Anul IV", "Master I", "Master II", "Doctorat"] : ["Clasa a IX-a", "Clasa a X-a", "Clasa a XI-a", "Clasa a XII-a"]).map((studyYear) => <option key={studyYear}>{studyYear}</option>)}</select></label>
              <label className="form-field"><span>Semestru</span><select onChange={(event) => updateField("semester", event.target.value)} required value={profile.semester}><option>Semestrul I</option><option>Semestrul II</option></select></label>
              <div className="form-field form-field-wide">
                <span>Orar (opțional)</span>
                <label className={`auth-file-picker${scheduleFileName ? " selected" : ""}`}>
                  <Icon name="upload" size={16} />
                  {scheduleFileProcessing
                    ? scheduleFileProgress || "Se procesează orarul..."
                    : scheduleFileName || "Upload File (Ex. PDF, JPG, IMG)"}
                  <input
                    accept={scheduleFileAccept}
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
            <div className="form-footer"><span className={`save-feedback${saveError ? " error" : ""}`} role={saveError ? "alert" : "status"}>{saveError || (saved ? "Modificările au fost salvate." : "")}</span><button className="button button-primary" disabled={saving} type="submit">{saving ? "Se salvează..." : "Salvează modificările"}</button></div>
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
