import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const key of ["select", "eq", "in"]) query[key] = vi.fn(() => query);
  query.order = vi.fn();
  return { query, from: vi.fn(() => query) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));
import { loadParticipantIds } from "./participant-ids";

describe("participant ID history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads only the current earner's IDs", async () => {
    db.query.order.mockResolvedValue({ data: [], error: null });
    await loadParticipantIds("earner-1");
    expect(db.query.eq).toHaveBeenCalledWith("user_id", "earner-1");
    expect(db.query.eq).toHaveBeenCalledTimes(1);
  });

  it("includes finished participation without filtering enabled or campaign status", async () => {
    const rows = [{ id: "assignment-1", anonymous_export_id: "P-12345678", evaluation_campaigns: { name: "Finished campaign" } }];
    db.query.order.mockResolvedValue({ data: rows, error: null });
    expect(await loadParticipantIds("earner-1")).toEqual(rows);
    expect(db.query.in).toHaveBeenCalledWith("consent_status", ["accepted", "finished", "withdrawn"]);
    expect(db.query.eq).not.toHaveBeenCalledWith("enabled", true);
    expect(db.query.eq).not.toHaveBeenCalledWith("evaluation_campaigns.status", "active");
  });

  it("surfaces a read error instead of presenting an empty history", async () => {
    const error = new Error("Read failed");
    db.query.order.mockResolvedValue({ data: null, error });
    await expect(loadParticipantIds("earner-1")).rejects.toThrow("Read failed");
  });
});