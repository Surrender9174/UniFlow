import { createClient } from "@supabase/supabase-js";
import WordExtractor from "word-extractor";

const maxFileSize = 15 * 1024 * 1024;
const maxExtractedTextLength = 500_000;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json({ error: "Procesarea documentului nu este configurată." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return Response.json({ error: "Autentifică-te din nou pentru a procesa acest document." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return Response.json({ error: "Sesiunea a expirat. Conectează-te din nou și încearcă iar." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxFileSize + 64 * 1024) {
    return Response.json({ error: "Fișierul depășește limita de 15 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Cererea nu conține un fișier valid." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".doc")) {
    return Response.json({ error: "Încarcă un document Word vechi cu extensia .doc." }, { status: 400 });
  }
  if (file.size > maxFileSize) {
    return Response.json({ error: "Fișierul depășește limita de 15 MB." }, { status: 413 });
  }

  try {
    const extractor = new WordExtractor();
    const document = await extractor.extract(Buffer.from(await file.arrayBuffer()));
    const text = document.getBody().trim();
    if (!text) {
      return Response.json({ error: "Documentul Word nu conține text care poate fi extras." }, { status: 422 });
    }
    if (text.length > maxExtractedTextLength) {
      return Response.json({ error: "Documentul conține prea mult text pentru a fi procesat ca orar." }, { status: 413 });
    }

    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Nu am putut citi documentul .doc. Verifică dacă fișierul este valid și încearcă din nou." }, { status: 422 });
  }
}
