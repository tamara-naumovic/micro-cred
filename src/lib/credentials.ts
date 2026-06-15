import { supabase } from "@/integrations/supabase/client";
import type { SharingSettings } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

export interface DbCredential {
  id: string;
  title: string;
  earner_id: string;
  earner_name: string;
  issuer_id: string;
  issuer_name: string;
  issued_at: string;
  expires_at: string | null;
  status: string;
  credential_lifecycle: string;
  rejection_reason: string | null;
  rejected_at: string | null;
  accepted_at: string | null;
  source: string;
  subcategory: string | null;
  level: string;
  ects: number | null;
  skills: string[];
  grade: string | null;
  share_token: string;
  share_is_public: boolean;
  share_show_grade: boolean;
  share_show_source: boolean;
  share_show_expiry: boolean;
  share_show_skills: boolean;
  share_show_level: boolean;
  share_show_prerequisites: boolean;
  share_show_supervision: boolean;
  share_show_integration: boolean;
  ebsi_status: string;
  ebsi_did: string | null;
  ebsi_vc_id: string | null;
  ebsi_tx_hash: string | null;
  revocation_reason: string | null;
  credential_hash: string | null;
  learner_commitment: string | null;
  learner_secret: string | null;
  template_ref: string | null;
  chain_status: string | null;
  chain_tx_hash: string | null;
  chain_block_number: number | null;
  chain_issuer_address: string | null;
  chain_contract_address: string | null;
}

export async function fetchMyCredential(id: string): Promise<DbCredential | null> {
  const { data, error } = await supabase
    .from("credentials")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Learner secret is stored in a separate, earner-only table. RLS restricts
  // SELECT to the credential owner; this simply tells us whether the private
  // ownership proof is downloadable for the viewer.
  const { data: secRow } = await supabase
    .from("credential_secrets")
    .select("secret")
    .eq("credential_id", id)
    .maybeSingle();

  const cred = data as unknown as DbCredential;
  cred.learner_secret = ((secRow as { secret: string } | null)?.secret) ?? null;
  return cred;
}

const SHARE_KEYS: Record<keyof SharingSettings, string> = {
  isPublic: "share_is_public",
  showGrade: "share_show_grade",
  showSource: "share_show_source",
  showExpiry: "share_show_expiry",
  showSkills: "share_show_skills",
  showLevel: "share_show_level",
  showPrerequisites: "share_show_prerequisites",
  showSupervision: "share_show_supervision",
  showIntegration: "share_show_integration",
};

export async function fetchCredentialVisibility(
  shareToken: string,
): Promise<{ exists: boolean; isPublic: boolean }> {
  const { data, error } = await supabase.rpc("get_credential_visibility", {
    _share_token: shareToken,
  });
  if (error) throw error;
  const row = (data as Array<{ exists_flag: boolean; is_public: boolean }> | null)?.[0];
  return { exists: !!row?.exists_flag, isPublic: !!row?.is_public };
}

export async function updateCredentialSharing(
  credentialId: string,
  patch: Partial<SharingSettings>,
): Promise<void> {
  const dbPatch: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(patch)) {
    const col = SHARE_KEYS[k as keyof SharingSettings];
    if (col && typeof v === "boolean") dbPatch[col] = v;
  }
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase
    .from("credentials")
    .update(dbPatch as never)
    .eq("id", credentialId);
  if (error) throw error;
}

export async function fetchPublicCredential(shareToken: string) {
  const { data, error } = await supabase.rpc("get_public_credential", { _share_token: shareToken });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchPublicProfile(shareToken: string) {
  const { data, error } = await supabase.rpc("get_public_profile", { _share_token: shareToken });
  if (error) throw error;
  return data?.[0] ?? null;
}
