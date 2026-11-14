import type { User } from "@supabase/supabase-js";
import {
  defaultProfile,
  getStoredProfileSnapshot,
  saveProfile,
  type StudentProfile,
} from "@/lib/profile";
import { parseScheduleText } from "@/lib/schedule-parser";
import { saveSchedule } from "@/lib/schedule-storage";
import { supabase } from "@/lib/supabase";

const studyYearValues: Record<string, number> = {
  "Anul I": 1,
  "Anul II": 2,
  "Anul III": 3,
  "Anul IV": 4,
  "Master I": 1,
  "Master II": 2,
  "Clasa a IX-a": 9,
  "Clasa a X-a": 10,
  "Clasa a XI-a": 11,
  "Clasa a XII-a": 12,
};

function getStudyYearValue(year: string) {
  if (year === "Doctorat") return null;
  const value = studyYearValues[year];
  if (value === undefined) throw new Error("Anul de studiu selectat nu este valid.");
  return value;
}

function getSemesterValue(semester: string) {
  if (semester === "Semestrul I") return 1;
  if (semester === "Semestrul II") return 2;
  throw new Error("Semestrul selectat nu este valid.");
}

function getMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function saveStudentProfileToDatabase(profile: StudentProfile) {
  if (!supabase) throw new Error("Supabase nu este configurat.");

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) throw new Error("Trebuie să fii autentificat pentru a salva profilul.");

  const { error } = await supabase
    .from("profiles")
    .update({
      name: profile.name.trim(),
      education_level: profile.institutionType === "Liceu" ? "highschool" : "university",
      institution: profile.university.trim(),
      study_year: getStudyYearValue(profile.year),
      semester: getSemesterValue(profile.semester),
      class_name: profile.program.trim(),
    })
    .eq("id", data.user.id);

  if (error) throw error;
}

function getStoredProfileForEmail(email: string): StudentProfile {
  const savedProfile = getStoredProfileSnapshot();
  if (!savedProfile) return { ...defaultProfile, email };

  const profile = JSON.parse(savedProfile) as Partial<StudentProfile>;
  if (profile.email?.toLowerCase() !== email.toLowerCase()) {
    return { ...defaultProfile, email };
  }
  return { ...defaultProfile, ...profile, email };
}

function getDatabaseStudyYear(
  studyYear: unknown,
  institutionType: StudentProfile["institutionType"],
  currentYear: string,
) {
  if (typeof studyYear !== "number") return currentYear;
  const currentYearType = currentYear.startsWith("Clasa") ? "Liceu" : "Universitate";
  if (currentYearType === institutionType && studyYearValues[currentYear] === studyYear) {
    return currentYear;
  }

  const labels = institutionType === "Liceu"
    ? { 9: "Clasa a IX-a", 10: "Clasa a X-a", 11: "Clasa a XI-a", 12: "Clasa a XII-a" }
    : { 1: "Anul I", 2: "Anul II", 3: "Anul III", 4: "Anul IV" };
  return labels[studyYear as keyof typeof labels] ?? currentYear;
}

export async function loadAuthenticatedProfileFromDatabase() {
  if (!supabase) throw new Error("Supabase nu este configurat.");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user?.email) {
    throw new Error("Trebuie să fii autentificat pentru a încărca profilul.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("name, education_level, institution, study_year, semester, class_name")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Nu există un profil în baza de date pentru acest cont.");

  const profile = getStoredProfileForEmail(userData.user.email);
  const institutionType = data.education_level === "highschool" ||
      data.education_level === "high-school"
    ? "Liceu"
    : data.education_level === "university"
      ? "Universitate"
      : profile.institutionType;

  return {
    ...profile,
    name: typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : profile.name,
    institutionType,
    university: typeof data.institution === "string" && data.institution.trim()
      ? data.institution.trim()
      : profile.university,
    program: typeof data.class_name === "string" && data.class_name.trim()
      ? data.class_name.trim()
      : profile.program,
    year: getDatabaseStudyYear(data.study_year, institutionType, profile.year),
    semester: data.semester === 1
      ? "Semestrul I"
      : data.semester === 2
        ? "Semestrul II"
        : profile.semester,
  } satisfies StudentProfile;
}

export async function saveAuthenticatedProfileToDatabase(user: User) {
  if (!supabase) throw new Error("Supabase nu este configurat.");

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("name, education_level, institution, study_year, semester, class_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!existingProfile) {
    throw new Error("Nu există un profil în baza de date pentru acest cont.");
  }

  const metadata = user.user_metadata;
  const update: {
    name?: string;
    education_level?: string;
    institution?: string;
    study_year?: number | null;
    semester?: number;
    class_name?: string;
  } = {};

  const name = getMetadataString(metadata.name);
  const institution = getMetadataString(metadata.university);
  const program = getMetadataString(metadata.program);
  const year = getMetadataString(metadata.year);
  const semester = getMetadataString(metadata.semester);
  const isEmpty = (value: unknown) =>
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "");

  if (name && isEmpty(existingProfile.name)) update.name = name;
  if (metadata.institutionType === "university" || metadata.institutionType === "high-school") {
    if (isEmpty(existingProfile.education_level)) {
      update.education_level =
        metadata.institutionType === "high-school" ? "highschool" : "university";
    }
  }
  if (institution && isEmpty(existingProfile.institution)) update.institution = institution;
  if (year === "Doctorat" && isEmpty(existingProfile.study_year)) {
    update.study_year = null;
  } else if (year && isEmpty(existingProfile.study_year)) {
    update.study_year = getStudyYearValue(year);
  }
  if (semester && isEmpty(existingProfile.semester)) {
    update.semester = getSemesterValue(semester);
  }
  if (program && isEmpty(existingProfile.class_name)) update.class_name = program;

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) throw error;
}

export function syncAuthenticatedProfile(user: User) {
  const email = user.email;
  if (!email) throw new Error("Contul nu conține o adresă de email.");

  const metadata = user.user_metadata;
  const metadataSchedule = typeof metadata.schedule === "string" ? metadata.schedule : "";
  const scheduleEvents = metadataSchedule.trim() ? parseScheduleText(metadataSchedule) : [];
  if (scheduleEvents.length) saveSchedule(scheduleEvents);
  const metadataType = metadata.institutionType;
  const profileFromMetadata: StudentProfile = {
    ...defaultProfile,
    name:
      typeof metadata.name === "string" && metadata.name.trim()
        ? metadata.name.trim()
        : email.split("@")[0],
    email,
    institutionType:
      metadataType === "Liceu" || metadataType === "high-school"
        ? "Liceu"
        : "Universitate",
    university:
      typeof metadata.university === "string" && metadata.university.trim()
        ? metadata.university.trim()
        : defaultProfile.university,
    program:
      typeof metadata.program === "string" && metadata.program.trim()
        ? metadata.program.trim()
        : defaultProfile.program,
    year:
      typeof metadata.year === "string" && metadata.year.trim()
        ? metadata.year.trim()
        : defaultProfile.year,
    semester:
      typeof metadata.semester === "string" && metadata.semester.trim()
        ? metadata.semester.trim()
        : defaultProfile.semester,
    schedule: metadataSchedule || defaultProfile.schedule,
  };

  const savedProfile = getStoredProfileSnapshot();
  if (savedProfile) {
    const profile = JSON.parse(savedProfile) as Partial<StudentProfile>;
    if (profile.email?.toLowerCase() === email.toLowerCase()) {
      saveProfile({ ...profileFromMetadata, ...profile, email });
      return;
    }
  }

  saveProfile(profileFromMetadata);
}
