import { supabase } from "@/integrations/supabase/client";

export const PARTICIPANT_ID_CONSENT_STATUSES = ["accepted", "finished", "withdrawn"];

/** Read-only history: independent of campaign status and tracking eligibility. */
export async function loadParticipantIds(userId: string) {
  const { data, error } = await supabase.from("evaluation_assignments")
    .select("id, anonymous_export_id, evaluation_campaigns(name)")
    .eq("user_id", userId)
    .in("consent_status", PARTICIPANT_ID_CONSENT_STATUSES)
    .order("invited_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}