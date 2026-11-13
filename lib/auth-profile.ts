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

  const savedProfile = getStoredProfileSnapshot();
  if (savedProfile) {
    const profile = JSON.parse(savedProfile) as Partial<StudentProfile>;
    if (profile.email?.toLowerCase() === email.toLowerCase()) {
      saveProfile({ ...defaultProfile, ...profile, email });
      return;
    }
  }

  const metadataName = user.user_metadata.name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : email.split("@")[0];

  saveProfile({ ...defaultProfile, name, email });
}
