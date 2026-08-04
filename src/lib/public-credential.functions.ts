import { createServerFn } from "@tanstack/react-start";

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
    // Admin client validates the credential/template relationship and mints a
    // short-lived signed URL on the private `qa-documents` bucket. We strictly
    // require the credential to be publicly shared and the requested path to
    // be one of the template's QA documents.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cred, error: credErr } = await supabaseAdmin
      .from("credentials")
      .select("template_id, share_is_public")
      .eq("share_token", data.shareToken)
      .maybeSingle();
    if (credErr) throw credErr;
    if (!cred || !cred.share_is_public || !cred.template_id) {
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
    for (const p of ((tpl?.qa_document_paths ?? []) as string[])) {
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

/**
 * Public, share-token-gated lookup of supersede state for a credential.
 * Returns the replacement's share token ONLY when the replacement is itself
 * publicly shared; otherwise the link is withheld.
 */
export const getPublicSupersedeInfo = createServerFn({ method: "POST" })
  .inputValidator((d: { shareToken: string }) => {
    if (!d || typeof d.shareToken !== "string") throw new Error("Invalid input");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred } = await supabaseAdmin
      .from("credentials")
      .select("share_is_public, credential_lifecycle, superseded_by_id")
      .eq("share_token", data.shareToken)
      .maybeSingle();
    if (!cred || !cred.share_is_public) return { superseded: false as const };
    if (cred.credential_lifecycle !== "superseded" || !cred.superseded_by_id) {
      return { superseded: false as const };
    }
    const { data: repl } = await supabaseAdmin
      .from("credentials")
      .select("share_token, share_is_public, expires_at")
      .eq("id", cred.superseded_by_id as string)
      .maybeSingle();
    return {
      superseded: true as const,
      replacementShareToken:
        repl && repl.share_is_public ? (repl.share_token as string) : null,
      replacementExpiresAt: repl && repl.share_is_public ? repl.expires_at : null,
    };
  });
