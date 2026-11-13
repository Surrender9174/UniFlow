import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { GMAIL_SESSION_COOKIE } from "@/lib/gmail-auth";
import {
  createSupabaseAdminClient,
  getRequestUser,
  SupabaseServerConfigurationError,
} from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  }

  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Autentifică-te din nou pentru a deconecta Gmail." },
        { status: 401 },
      );
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("gmail_connections").delete().eq("user_id", user.id);
    if (error) throw error;

    const response = NextResponse.json({ disconnected: true });
    response.cookies.delete(GMAIL_SESSION_COOKIE);
    return response;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Gmail disconnect failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof SupabaseServerConfigurationError
            ? error.message
            : "Nu am putut deconecta Gmail.",
      },
      { status: error instanceof SupabaseServerConfigurationError ? 503 : 500 },
    );
  }
}
