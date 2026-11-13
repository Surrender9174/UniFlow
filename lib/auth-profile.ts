import type { User } from "@supabase/supabase-js";
import {
  defaultProfile,
  getStoredProfileSnapshot,
  saveProfile,
  type StudentProfile,
} from "@/lib/profile";

export function syncAuthenticatedProfile(user: User) {
  const email = user.email;
  if (!email) throw new Error("Contul nu conține o adresă de email.");

  const metadata = user.user_metadata;
  const metadataType = metadata.institutionType;
  const profileFromMetadata: StudentProfile = {
    ...defaultProfile,
    name:
      typeof metadata.name === "string" && metadata.name.trim()
        ? metadata.name.trim()
        : email.split("@")[0],
    email,
    institutionType: metadataType === "high-school" ? "high-school" : "university",
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
    schedule:
      typeof metadata.schedule === "string" ? metadata.schedule : defaultProfile.schedule,
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
