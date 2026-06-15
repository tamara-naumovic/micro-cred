import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { issueCredentialsBatch } from "@/lib/chain/anchor.functions";

import {
  LIFECYCLE_STAGES,
  type AppNotification,
  type AuditEvent,
  type CredentialApplication,
  type CredentialStatus,
  type EarnerInstitution,
  type IssuedCredential,
  type Level,
  type LearningSource,
  type MicroCredentialTemplate,
  type MockUser,
  type NonFormalSubcategory,
  type Organization,
  type Participation,
  type PlatformEvent,
  type RegistrationRequest,
  type RequestStatus,
  type Role,
  type SharingSettings,
  type TemplateAssignment,
  type TemplateStatus,
  type TimelineEvent,
} from "./types";

const ROLE_KEY = "mc-active-user-v4";

interface State {
  templates: MicroCredentialTemplate[];
  credentials: IssuedCredential[];
  applications: CredentialApplication[];
  notifications: AppNotification[];
  organizations: Organization[];
  registrations: RegistrationRequest[];
  audit: AuditEvent[];
  events: PlatformEvent[];
  users: MockUser[];
  templateAssignees: TemplateAssignment[];
  earnerInstitutions: EarnerInstitution[];
}

const emptyState: State = {
  templates: [],
  credentials: [],
  applications: [],
  notifications: [],
  organizations: [],
  registrations: [],
  audit: [],
  events: [],
  users: [],
  templateAssignees: [],
  earnerInstitutions: [],
};

export interface BulkRow {
  email: string;
  grade?: string;
  expiryDate?: string;
}

interface StoreCtx extends State {
  activeUser: MockUser | null;
  setActiveUser: (u: MockUser | null) => void;
  loading: boolean;

  createApplication: (templateId: string) => CredentialApplication | null;
  updateSharing: (credentialId: string, settings: Partial<SharingSettings>) => void;

  advanceApplicationStatus: (
    applicationId: string,
    opts?: { grade?: string; expiryDate?: string },
  ) => CredentialApplication | null;
  rejectApplication: (applicationId: string, reason: string) => void;
  addReviewerComment: (applicationId: string, text: string) => void;

  issueFromApplication: (
    applicationId: string,
    opts?: { grade?: string; expiryDate?: string },
  ) => IssuedCredential | null;
  directIssue: (
    templateId: string,
    recipients: { earnerId: string; grade?: string; expiryDate?: string }[],
    issueDate?: string,
  ) => IssuedCredential[];
  bulkIssue: (templateId: string, rows: BulkRow[]) => IssuedCredential[];
  revokeCredential: (credentialId: string, reason: string) => void;
  upsertTemplate: (t: MicroCredentialTemplate) => void;
  archiveTemplate: (id: string) => void;
  assignTemplateUsers: (templateId: string, userIds: string[]) => Promise<void>;

  approveRegistration: (id: string) => void;
  rejectRegistration: (id: string) => void;

  markAllRead: (role: Role, userId?: string) => void;
  markRead: (id: string) => void;
  reset: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

function loadUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

function mapDbRoleToRole(dbRole: string): Role {
  if (dbRole === "issuer_admin" || dbRole === "issuer_staff") return "issuer";
  if (dbRole === "platform_admin") return "admin";
  return "earner";
}

function mapDbRoleToSubRole(dbRole: string): "admin" | "staff" | undefined {
  if (dbRole === "issuer_admin") return "admin";
  if (dbRole === "issuer_staff") return "staff";
  return undefined;
}

const ROLE_PRIORITY: Record<string, number> = {
  platform_admin: 4,
  issuer_admin: 3,
  issuer_staff: 2,
  earner: 1,
  verifier: 0,
};

// ============ Row mappers ============
type Row = Record<string, unknown>;

function mapTemplate(r: Row, orgName: Map<string, string>): MicroCredentialTemplate {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? "",
    issuerId: r.issuer_id as string,
    issuerName: orgName.get(r.issuer_id as string) ?? "Unknown issuer",
    country: (r.country as string) ?? "",
    source: r.source as LearningSource,
    subcategory: (r.subcategory as NonFormalSubcategory | null) ?? undefined,
    outcomes: (r.outcomes as string[]) ?? [],
    skills: (r.skills as string[]) ?? [],
    ects: (r.ects as number | null) ?? undefined,
    level: (r.level as Level) ?? "N/A",
    assessment: (r.assessment as string) ?? "",
    participation: (r.participation as Participation) ?? "online",
    qualityAssurance: (r.quality_assurance as string) ?? "",
    qaType: ((r.qa_type as string) ?? "not_specified") as MicroCredentialTemplate["qaType"],
    qaDocumentPath: (r.qa_document_path as string | null) ?? undefined,
    prerequisites: (r.prerequisites as string) ?? "",
    prerequisitesNone: (r.prerequisites_none as boolean | null) ?? true,
    supervision: (r.supervision as string) ?? "",
    supervisionType: (r.supervision_type as MicroCredentialTemplate["supervisionType"] | null) ?? undefined,
    stackability: (r.stackability as string) ?? "",
    stackabilityType: (r.stackability_type as MicroCredentialTemplate["stackabilityType"] | null) ?? undefined,
    furtherInfo: (r.further_info as string | null) ?? undefined,
    expiryMode: ((r.expiry_mode as string | null) === "fixed_date" ? "fixed_date" : "never"),
    expiryDate: (r.expiry_date as string | null) ?? undefined,
    status: (r.status as TemplateStatus) ?? "draft",
    version: (r.version as string) ?? "1.0",
  };
}

function mapCredential(r: Row): IssuedCredential {
  return {
    id: r.id as string,
    templateId: r.template_id as string,
    title: r.title as string,
    earnerId: r.earner_id as string,
    earnerName: r.earner_name as string,
    issuerId: r.issuer_id as string,
    issuerName: r.issuer_name as string,
    issuedAt: r.issued_at as string,
    expiresAt: (r.expires_at as string | null) ?? undefined,
    status: r.status as CredentialStatus,
    source: r.source as LearningSource,
    subcategory: (r.subcategory as NonFormalSubcategory | null) ?? undefined,
    level: (r.level as Level) ?? "N/A",
    ects: (r.ects as number | null) ?? undefined,
    skills: (r.skills as string[]) ?? [],
    grade: (r.grade as string | null) ?? undefined,
    verificationLink: `/verify/${(r.share_token as string | null) ?? (r.id as string)}`,
    shareToken: (r.share_token as string | null) ?? undefined,
    sharing: {
      isPublic: (r.share_is_public as boolean) ?? true,
      showGrade: (r.share_show_grade as boolean) ?? true,
      showSource: (r.share_show_source as boolean) ?? true,
      showExpiry: (r.share_show_expiry as boolean) ?? true,
      showSkills: (r.share_show_skills as boolean) ?? true,
      showLevel: ((r as Record<string, unknown>).share_show_level as boolean) ?? true,
      showPrerequisites: ((r as Record<string, unknown>).share_show_prerequisites as boolean) ?? true,
      showSupervision: ((r as Record<string, unknown>).share_show_supervision as boolean) ?? true,
      showIntegration: ((r as Record<string, unknown>).share_show_integration as boolean) ?? true,
    },
    blockchain: {
      did: (r.ebsi_did as string | null) ?? undefined,
      vcId: (r.ebsi_vc_id as string | null) ?? undefined,
      txHash: (r.chain_tx_hash as string | null) ?? (r.ebsi_tx_hash as string | null) ?? undefined,
      ebsiStatus: (r.ebsi_status as "not_anchored" | "pending" | "anchored") ?? "not_anchored",
      chainStatus: (r.chain_status as "pending" | "submitted" | "confirmed" | "failed" | "disabled" | null) ?? "pending",
      blockNumber: (r.chain_block_number as number | null) ?? undefined,
      issuerAddress: (r.chain_issuer_address as string | null) ?? undefined,
      contractAddress: (r.chain_contract_address as string | null) ?? undefined,
      documentHash: (r.credential_hash as string | null) ?? undefined,
      learnerCommitment: (r.learner_commitment as string | null) ?? undefined,
      templateRef: (r.template_ref as string | null) ?? undefined,
      learnerSecret: (r.learner_secret as string | null) ?? undefined,
    },
    revocationReason: (r.revocation_reason as string | null) ?? undefined,
    renewedFromId: (r.renewed_from_id as string | null) ?? undefined,
    lifecycle: ((r.credential_lifecycle as string | null) ?? "issued") as IssuedCredential["lifecycle"],
    rejectionReason: (r.rejection_reason as string | null) ?? undefined,
  };
}

function mapNotification(r: Row): AppNotification {
  return {
    id: r.id as string,
    forRole: r.for_role
      ? mapDbRoleToRole(r.for_role as string)
      : ("earner" as Role),
    forUserId: (r.for_user_id as string | null) ?? undefined,
    title: r.title as string,
    body: r.body as string,
    createdAt: r.created_at as string,
    read: (r.read as boolean) ?? false,
    link: (r.link as string | null) ?? undefined,
  };
}

function mapOrg(r: Row): Organization {
  return {
    id: r.id as string,
    name: r.name as string,
    type: "issuer",
    country: r.country as string,
    about: (r.about as string | null) ?? undefined,
    website: (r.website as string | null) ?? undefined,
    accreditations: (r.accreditations as string[]) ?? [],
    registeredAt: r.registered_at as string,
  };
}

function mapRegistration(r: Row): RegistrationRequest {
  return {
    id: r.id as string,
    type: "issuer",
    organizationName: r.organization_name as string,
    contactName: r.contact_name as string,
    contactEmail: r.contact_email as string,
    country: r.country as string,
    submittedAt: r.submitted_at as string,
    status: (r.status as "pending" | "approved" | "rejected") ?? "pending",
  };
}

function mapAudit(r: Row): AuditEvent {
  return {
    id: r.id as string,
    at: r.created_at as string,
    actor: (r.actor_name as string) ?? "system",
    action: r.action as string,
    target: r.target as string,
  };
}

function mapEvent(r: Row): PlatformEvent {
  return {
    id: r.id as string,
    at: r.created_at as string,
    type: r.type as PlatformEvent["type"],
    description: r.description as string,
  };
}

function nowISO() {
  return new Date().toISOString();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const [activeUser, setActiveUserState] = useState<MockUser | null>(null);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef<State>(emptyState);
  stateRef.current = state;
  const activeUserRef = useRef<MockUser | null>(null);
  activeUserRef.current = activeUser;

  const setActiveUser = useCallback((u: MockUser | null) => {
    setActiveUserState(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem(ROLE_KEY, JSON.stringify(u));
      else localStorage.removeItem(ROLE_KEY);
    }
  }, []);

  useEffect(() => {
    setActiveUserState(loadUser());
  }, []);

  // ============ Loaders ============
  const refetchAll = useCallback(async () => {
    try {
      const [
        tplRes,
        appRes,
        credRes,
        notifRes,
        orgRes,
        regRes,
        auditRes,
        eventRes,
        profilesRes,
        rolesRes,
        tlRes,
        commentsRes,
        taRes,
        eiRes,
      ] = await Promise.all([
        supabase.from("templates").select("*"),
        supabase.from("applications").select("*"),
        supabase.from("credentials").select("*"),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }),
        supabase.from("organizations").select("*"),
        supabase.from("registration_requests").select("*"),
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("platform_events").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("application_timeline").select("*").order("created_at", { ascending: true }),
        supabase.from("application_comments").select("*").order("created_at", { ascending: true }),
        supabase.from("template_assignees").select("template_id, user_id"),
        supabase.from("earner_institutions").select("earner_id, organization_id"),
      ]);


      const orgs = (orgRes.data ?? []).map(mapOrg);
      const orgName = new Map(orgs.map((o) => [o.id, o.name]));

      const templates = (tplRes.data ?? []).map((r) => mapTemplate(r as Row, orgName));
      const templateById = new Map(templates.map((t) => [t.id, t]));

      const profiles = (profilesRes.data ?? []) as Row[];
      const profileById = new Map(profiles.map((p) => [p.id as string, p]));
      const roles = (rolesRes.data ?? []) as Row[];
      const rolesByUser = new Map<string, Row[]>();
      for (const r of roles) {
        const uid = r.user_id as string;
        const arr = rolesByUser.get(uid) ?? [];
        arr.push(r);
        rolesByUser.set(uid, arr);
      }
      const users: MockUser[] = profiles.map((p) => {
        const userRoles = rolesByUser.get(p.id as string) ?? [];
        const sorted = [...userRoles].sort(
          (a, b) => (ROLE_PRIORITY[b.role as string] ?? 0) - (ROLE_PRIORITY[a.role as string] ?? 0),
        );
        const primary = sorted[0];
        const primaryRole = (primary?.role as string | undefined) ?? "earner";
        return {
          id: p.id as string,
          name: (p.display_name as string) || ((p.email as string)?.split("@")[0] ?? "User"),
          email: (p.email as string) ?? "",
          role: mapDbRoleToRole(primaryRole),
          subRole: mapDbRoleToSubRole(primaryRole),
          organizationId: (primary?.organization_id as string | undefined) ?? undefined,
          organization: primary?.organization_id
            ? orgName.get(primary.organization_id as string)
            : undefined,
          studentId: (p.student_id as string | null) ?? undefined,
        };
      });

      // Group timeline + comments by application
      const timelineByApp = new Map<string, TimelineEvent[]>();
      for (const t of tlRes.data ?? []) {
        const tt = t as Row;
        const list = timelineByApp.get(tt.application_id as string) ?? [];
        list.push({
          id: tt.id as string,
          at: tt.created_at as string,
          actor: (tt.actor_name as string) ?? "system",
          action: tt.action as string,
          detail: (tt.detail as string | null) ?? undefined,
        });
        timelineByApp.set(tt.application_id as string, list);
      }
      const commentsByApp = new Map<string, { author: string; at: string; text: string }[]>();
      for (const c of commentsRes.data ?? []) {
        const cc = c as Row;
        const list = commentsByApp.get(cc.application_id as string) ?? [];
        list.push({
          author: (cc.author_name as string) ?? "anonymous",
          at: cc.created_at as string,
          text: cc.text as string,
        });
        commentsByApp.set(cc.application_id as string, list);
      }

      const applications: CredentialApplication[] = (appRes.data ?? []).map((r) => {
        const rr = r as Row;
        const tpl = templateById.get(rr.template_id as string);
        const earnerProfile = profileById.get(rr.earner_id as string);
        return {
          id: rr.id as string,
          earnerId: rr.earner_id as string,
          earnerName:
            (earnerProfile?.display_name as string) ||
            ((earnerProfile?.email as string)?.split("@")[0] ?? "Earner"),
          templateId: rr.template_id as string,
          templateTitle: tpl?.title ?? "Unknown template",
          issuerId: rr.issuer_id as string,
          issuerName: orgName.get(rr.issuer_id as string) ?? "Unknown issuer",
          status: rr.status as RequestStatus,
          reviewerComments: commentsByApp.get(rr.id as string) ?? [],
          timeline: timelineByApp.get(rr.id as string) ?? [],
          createdAt: rr.created_at as string,
          updatedAt: rr.updated_at as string,
          resultingCredentialId: (rr.resulting_credential_id as string | null) ?? undefined,
        };
      });

      const credentials = (credRes.data ?? []).map((r) => mapCredential(r as Row));
      const notifications = (notifRes.data ?? []).map((r) => mapNotification(r as Row));
      const registrations = (regRes.data ?? []).map((r) => mapRegistration(r as Row));
      const audit = (auditRes.data ?? []).map((r) => mapAudit(r as Row));
      const events = (eventRes.data ?? []).map((r) => mapEvent(r as Row));
      const templateAssignees: TemplateAssignment[] = (taRes.data ?? []).map((r) => ({
        templateId: (r as Row).template_id as string,
        userId: (r as Row).user_id as string,
      }));
      const earnerInstitutions: EarnerInstitution[] = (eiRes.data ?? []).map((r) => ({
        earnerId: (r as Row).earner_id as string,
        organizationId: (r as Row).organization_id as string,
      }));

      setState({
        templates,
        credentials,
        applications,
        notifications,
        organizations: orgs,
        registrations,
        audit,
        events,
        users,
        templateAssignees,
        earnerInstitutions,
      });
    } catch (e) {
      console.error("[store] refetchAll failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + realtime
  useEffect(() => {
    refetchAll();

    const channel = supabase
      .channel("store-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "templates" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "credentials" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "application_timeline" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "application_comments" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "registration_requests" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "organizations" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "template_assignees" }, () => refetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "earner_institutions" }, () => refetchAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchAll]);

  // Refetch whenever the active user changes (RLS gives different rows)
  useEffect(() => {
    if (activeUser) refetchAll();
  }, [activeUser, refetchAll]);

  // ============ Mutations (fire-and-forget, realtime updates UI) ============

  const createApplication: StoreCtx["createApplication"] = useCallback((templateId) => {
    const earner = activeUserRef.current;
    const tpl = state.templates.find((t) => t.id === templateId);
    if (!earner || !tpl) return null;
    (async () => {
      const { data, error } = await supabase
        .from("applications")
        .insert({
          template_id: tpl.id,
          issuer_id: tpl.issuerId,
          earner_id: earner.id,
          status: "submitted",
        })
        .select()
        .single();
      if (error) {
        console.error("[store] createApplication", error);
        return;
      }
      await supabase.from("application_timeline").insert({
        application_id: data.id,
        actor_name: earner.name,
        action: "Application submitted",
      });
      refetchAll();
    })();
    // Optimistic placeholder so caller can navigate
    return {
      id: "pending",
      earnerId: earner.id,
      earnerName: earner.name,
      templateId: tpl.id,
      templateTitle: tpl.title,
      issuerId: tpl.issuerId,
      issuerName: tpl.issuerName,
      status: "submitted",
      reviewerComments: [],
      timeline: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
  }, [state.templates, refetchAll]);

  const updateSharing: StoreCtx["updateSharing"] = useCallback((credentialId, settings) => {
    const patch: Record<string, unknown> = {};
    if (settings.isPublic !== undefined) patch.share_is_public = settings.isPublic;
    if (settings.showGrade !== undefined) patch.share_show_grade = settings.showGrade;
    if (settings.showSource !== undefined) patch.share_show_source = settings.showSource;
    if (settings.showExpiry !== undefined) patch.share_show_expiry = settings.showExpiry;
    if (settings.showSkills !== undefined) patch.share_show_skills = settings.showSkills;
    if (settings.showLevel !== undefined) patch.share_show_level = settings.showLevel;
    if (settings.showPrerequisites !== undefined) patch.share_show_prerequisites = settings.showPrerequisites;
    if (settings.showSupervision !== undefined) patch.share_show_supervision = settings.showSupervision;
    if (settings.showIntegration !== undefined) patch.share_show_integration = settings.showIntegration;
    (supabase.from("credentials") as unknown as { update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: unknown }> } })
      .update(patch).eq("id", credentialId).then(({ error }) => {
      if (error) console.error("[store] updateSharing", error);
    });
  }, []);

  const buildCredentialInsert = useCallback(
    (
      tpl: MicroCredentialTemplate,
      earner: { id: string; name: string },
      grade?: string,
      expiryDate?: string,
      issuedAt?: string,
    ): Record<string, unknown> => ({
      template_id: tpl.id,
      title: tpl.title,
      earner_id: earner.id,
      earner_name: earner.name,
      issuer_id: tpl.issuerId,
      issuer_name: tpl.issuerName,
      issued_at: issuedAt ?? nowISO(),
      expires_at: expiryDate ?? (tpl.expiryMode === "fixed_date" ? (tpl.expiryDate ?? null) : null),
      status: "active",
      credential_lifecycle: "pending_earner_acceptance",
      source: tpl.source,
      subcategory: tpl.subcategory ?? null,
      level: tpl.level,
      ects: tpl.ects ?? null,
      skills: tpl.skills,
      grade: grade ?? null,
    }),
    [],
  );

  const issueFromApplication: StoreCtx["issueFromApplication"] = useCallback((appId, opts) => {
    const app = state.applications.find((a) => a.id === appId);
    if (!app) return null;
    const tpl = state.templates.find((t) => t.id === app.templateId);
    if (!tpl) return null;
    (async () => {
      const { data: cred, error } = await supabase
        .from("credentials")
        .insert(
          buildCredentialInsert(
            tpl,
            { id: app.earnerId, name: app.earnerName },
            opts?.grade,
            opts?.expiryDate,
          ) as unknown as never,
        )
        .select()
        .single();
      if (error) {
        console.error("[store] issueFromApplication", error);
        return;
      }
      await supabase
        .from("applications")
        .update({ status: "issued", resulting_credential_id: cred.id })
        .eq("id", appId);
      await supabase.from("application_timeline").insert({
        application_id: appId,
        actor_name: activeUserRef.current?.name ?? "Issuer",
        action: "Credential issued",
      });
      // Anchoring is deferred until the earner accepts the credential.
      refetchAll();
    })();
    return null;
  }, [state.applications, state.templates, buildCredentialInsert, refetchAll]);

  const advanceApplicationStatus: StoreCtx["advanceApplicationStatus"] = useCallback((appId, opts) => {
    const app = state.applications.find((a) => a.id === appId);
    if (!app) return null;
    const idx = LIFECYCLE_STAGES.indexOf(app.status);
    if (idx < 0 || idx >= LIFECYCLE_STAGES.length - 1) return null;
    const next = LIFECYCLE_STAGES[idx + 1];
    if (next === "issued") {
      issueFromApplication(appId, opts);
      return app;
    }
    (async () => {
      await supabase.from("applications").update({ status: next }).eq("id", appId);
      await supabase.from("application_timeline").insert({
        application_id: appId,
        actor_name: activeUserRef.current?.name ?? "Issuer",
        action: `Moved to ${next.replace(/_/g, " ")}`,
      });
      refetchAll();
    })();
    return { ...app, status: next };
  }, [state.applications, issueFromApplication, refetchAll]);

  const rejectApplication: StoreCtx["rejectApplication"] = useCallback((appId, reason) => {
    (async () => {
      await supabase.from("applications").update({ status: "rejected" }).eq("id", appId);
      await supabase.from("application_timeline").insert({
        application_id: appId,
        actor_name: activeUserRef.current?.name ?? "Issuer",
        action: "Application rejected",
        detail: reason,
      });
      refetchAll();
    })();
  }, [refetchAll]);

  const addReviewerComment: StoreCtx["addReviewerComment"] = useCallback((appId, text) => {
    (async () => {
      await supabase.from("application_comments").insert({
        application_id: appId,
        author_id: activeUserRef.current?.id ?? null,
        author_name: activeUserRef.current?.name ?? "Issuer",
        text,
      });
      refetchAll();
    })();
  }, [refetchAll]);

  const directIssue: StoreCtx["directIssue"] = useCallback((templateId, recipients, issueDate) => {
    const tpl = state.templates.find((t) => t.id === templateId);
    if (!tpl) return [];
    (async () => {
      const rows = recipients
        .map((r) => {
          const u = state.users.find((x) => x.id === r.earnerId);
          if (!u) return null;
          return buildCredentialInsert(tpl, { id: u.id, name: u.name }, r.grade, r.expiryDate, issueDate);
        })
        .filter((x): x is Record<string, unknown> => !!x);
      if (rows.length === 0) return;
      const { data: inserted, error } = await (supabase.from("credentials") as unknown as {
        insert: (r: Record<string, unknown>[]) => { select: () => Promise<{ data: { id: string }[] | null; error: unknown }> };
      }).insert(rows).select();
      if (error) console.error("[store] directIssue", error);
      // Anchoring deferred until earner acceptance.
      void inserted;
      refetchAll();
    })();
    return [];
  }, [state.templates, state.users, buildCredentialInsert, refetchAll]);

  const bulkIssue: StoreCtx["bulkIssue"] = useCallback((templateId, rows) => {
    // Bulk issuance to non-existent earners is not supported with real auth.
    // We attempt to match by email; unmatched rows are skipped.
    const tpl = state.templates.find((t) => t.id === templateId);
    if (!tpl) return [];
    (async () => {
      const inserts: Record<string, unknown>[] = [];
      for (const r of rows) {
        const u = state.users.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
        if (!u) continue;
        inserts.push(
          buildCredentialInsert(
            tpl,
            { id: u.id, name: u.name },
            r.grade,
            r.expiryDate,
          ),
        );
      }
      if (inserts.length === 0) {
        console.warn("[store] bulkIssue: no matching earners found by email");
        return;
      }
      const { error } = await (supabase.from("credentials") as unknown as { insert: (r: Record<string, unknown>[]) => Promise<{ error: unknown }> }).insert(inserts);
      if (error) console.error("[store] bulkIssue", error);
      refetchAll();
    })();
    return [];
  }, [state.templates, state.users, buildCredentialInsert, refetchAll]);

  const revokeCredential: StoreCtx["revokeCredential"] = useCallback((id, reason) => {
    (async () => {
      await supabase
        .from("credentials")
        .update({ status: "revoked", revocation_reason: reason })
        .eq("id", id);
      refetchAll();
    })();
  }, [refetchAll]);

  const upsertTemplate: StoreCtx["upsertTemplate"] = useCallback((t) => {
    (async () => {
      const row = {
        id: t.id,
        title: t.title,
        description: t.description,
        issuer_id: t.issuerId,
        country: t.country,
        source: t.source,
        subcategory: t.subcategory ?? null,
        outcomes: t.outcomes,
        skills: t.skills,
        ects: t.ects ?? null,
        level: t.level,
        assessment: t.assessment,
        participation: t.participation,
        quality_assurance: t.qualityAssurance,
        qa_type: t.qaType,
        qa_document_path: t.qaDocumentPath ?? null,
        prerequisites: t.prerequisites,
        prerequisites_none: t.prerequisitesNone,
        supervision: t.supervision,
        supervision_type: t.supervisionType ?? null,
        stackability: t.stackability,
        stackability_type: t.stackabilityType ?? null,
        further_info: t.furtherInfo ?? null,
        expiry_mode: t.expiryMode ?? "never",
        expiry_date: t.expiryMode === "fixed_date" ? (t.expiryDate ?? null) : null,
        status: t.status,
        version: t.version,
        created_by: activeUserRef.current?.id ?? null,
      };
      const { error } = await (supabase.from("templates") as unknown as { upsert: (r: Record<string, unknown>) => Promise<{ error: unknown }> }).upsert(row);
      if (error) {
        console.error("[store] upsertTemplate", error);
        toast.error(`Failed to save template: ${(error as { message?: string })?.message ?? "unknown error"}`);
        return;
      }
      refetchAll();
    })();
  }, [refetchAll]);

  const archiveTemplate: StoreCtx["archiveTemplate"] = useCallback((id) => {
    (async () => {
      await supabase.from("templates").update({ status: "archived" }).eq("id", id);
      refetchAll();
    })();
  }, [refetchAll]);

  const assignTemplateUsers: StoreCtx["assignTemplateUsers"] = useCallback(async (templateId, userIds) => {
    const actor = activeUserRef.current;
    const { data: existing } = await supabase
      .from("template_assignees")
      .select("user_id")
      .eq("template_id", templateId);
    const existingIds = new Set((existing ?? []).map((r) => r.user_id as string));
    const toAdd = userIds.filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !userIds.includes(id));
    if (toAdd.length > 0) {
      const rows = toAdd.map((uid) => ({
        template_id: templateId,
        user_id: uid,
        assigned_by: actor?.id ?? null,
      }));
      const { error } = await (supabase.from("template_assignees") as unknown as {
        insert: (r: Record<string, unknown>[]) => Promise<{ error: unknown }>;
      }).insert(rows);
      if (error) console.error("[store] assignTemplateUsers insert", error);
    }
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("template_assignees")
        .delete()
        .eq("template_id", templateId)
        .in("user_id", toRemove);
      if (error) console.error("[store] assignTemplateUsers delete", error);
    }
    await refetchAll();
  }, [refetchAll]);


  const approveRegistration: StoreCtx["approveRegistration"] = useCallback((id) => {
    (async () => {
      await supabase
        .from("registration_requests")
        .update({
          status: "approved",
          reviewed_by: activeUserRef.current?.id ?? null,
          reviewed_at: nowISO(),
        })
        .eq("id", id);
      refetchAll();
    })();
  }, [refetchAll]);

  const rejectRegistration: StoreCtx["rejectRegistration"] = useCallback((id) => {
    (async () => {
      await supabase
        .from("registration_requests")
        .update({
          status: "rejected",
          reviewed_by: activeUserRef.current?.id ?? null,
          reviewed_at: nowISO(),
        })
        .eq("id", id);
      refetchAll();
    })();
  }, [refetchAll]);

  const markAllRead: StoreCtx["markAllRead"] = useCallback((role, userId) => {
    const uid = userId ?? activeUserRef.current?.id;
    const ids = stateRef.current.notifications
      .filter(
        (n) =>
          !n.read &&
          n.forRole === role &&
          (!n.forUserId || n.forUserId === uid),
      )
      .map((n) => n.id);
    if (ids.length === 0) return;
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        ids.includes(n.id) ? { ...n, read: true } : n,
      ),
    }));
    (async () => {
      await supabase.from("notifications").update({ read: true }).in("id", ids);
    })();
  }, []);

  const markRead: StoreCtx["markRead"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
    (async () => {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    })();
  }, []);

  const reset = useCallback(() => {
    refetchAll();
  }, [refetchAll]);

  const value = useMemo<StoreCtx>(
    () => ({
      ...state,
      activeUser,
      setActiveUser,
      loading,
      createApplication,
      updateSharing,
      advanceApplicationStatus,
      rejectApplication,
      addReviewerComment,
      issueFromApplication,
      directIssue,
      bulkIssue,
      revokeCredential,
      upsertTemplate,
      archiveTemplate,
      assignTemplateUsers,
      approveRegistration,
      rejectRegistration,
      markAllRead,
      markRead,
      reset,
    }),
    [
      state, activeUser, setActiveUser, loading, createApplication, updateSharing,
      advanceApplicationStatus, rejectApplication, addReviewerComment,
      issueFromApplication, directIssue, bulkIssue, revokeCredential,
      upsertTemplate, archiveTemplate, assignTemplateUsers, approveRegistration, rejectRegistration,
      markAllRead, markRead, reset,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
