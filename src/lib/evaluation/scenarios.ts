import { supabase } from "@/integrations/supabase/client";
import { availableScenarioVersions, loadScenarioVersion } from "./logic";

const db = supabase as any;

/** Shared by participant lists and admin reporting so both resolve the same IDs. */
export function loadEarnerScenarios<T>(version: string | null | undefined): Promise<T[]> {
  return loadScenarioVersion<T>(version, async (requested) => {
    const { data, error } = await db.from("evaluation_scenarios").select("*")
      .eq("role", "earner").eq("version", requested).order("sort_order");
    if (error) throw error;
    return data ?? [];
  });
}

export async function loadEarnerScenarioVersions(): Promise<string[]> {
  const { data, error } = await db.from("evaluation_scenarios").select("version").eq("role", "earner");
  if (error) throw error;
  return availableScenarioVersions(data ?? []);
}