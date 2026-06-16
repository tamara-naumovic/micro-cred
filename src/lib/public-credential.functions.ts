import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

interface Input {
  shareToken: string;
  path: string;
}

export const getPublicQaDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => {
    if (!d || typeof d.shareToken !== "string" || typeof d.path !== "string") {
      throw new Error("Invalid input");
    }
    return d;
  })
  .handler(async ({ data }) => {
    // Use admin client to validate the credential/template relationship and
    // mint a signed URL on the private `qa-documents` bucket. The handler
    // strictly enforces that the credential is publicly shared and that the
    // requested path is one of the template's QA documents.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cred, error: credErr } = await supabaseAdmin
      .from("credentials")
      .select("template_id, share_is_public")
      .eq("share_token", data.shareToken)
      .maybeSingle();
    if (credErr) throw credErr;
    if (!cred || !cred.share_is_public) {
      throw new Error("Credential not publicly shared");
    }

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("templates")
      .select("qa_document_path, qa_document_paths")
      .eq("id", cred.template_id as string)
      .maybeSingle();
    if (tplErr) throw tplErr;

    const allowed = new Set<string>();
    if (tpl?.qa_document_path) allowed.add(tpl.qa_document_path);
    for (const p of (tpl?.qa_document_paths ?? []) as string[]) {
      if (p) allowed.add(p);
    }
    if (!allowed.has(data.path)) {
      throw new Error("Path not allowed for this credential");
    }

    const expiresIn = 300;
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("qa-documents")
      .createSignedUrl(data.path, expiresIn);
    if (signErr) throw signErr;
    return { url: signed.signedUrl, expiresInSec: expiresIn };
  });

// Avoid unused-import warnings when type-checking under stricter configs
type _DbHint = Database;
const _createClient = createClient;
void _createClient;
