import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  mockApplications,
  mockAudit,
  mockCredentials,
  mockNotifications,
  mockOrganizations,
  mockPlatformEvents,
  mockRegistrations,
  mockTemplates,
  mockUsers,
} from "./mock-data";
import {
  LIFECYCLE_STAGES,
  type AppNotification,
  type AuditEvent,
  type CredentialApplication,
  type CredentialStatus,
  type IssuedCredential,
  type MicroCredentialTemplate,
  type MockUser,
  type Organization,
  type PlatformEvent,
  type RegistrationRequest,
  type RequestStatus,
  type Role,
  type SharingSettings,
  type TimelineEvent,
} from "./types";

const KEY = "mc-platform-state-v3";
const ROLE_KEY = "mc-platform-active-user-v3";

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
}

const initialState: State = {
  templates: mockTemplates,
  credentials: mockCredentials,
  applications: mockApplications,
  notifications: mockNotifications,
  organizations: mockOrganizations,
  registrations: mockRegistrations,
  audit: mockAudit,
  events: mockPlatformEvents,
  users: mockUsers,
};

export interface BulkRow {
  email: string;
  firstName: string;
  lastName: string;
  studentId: string;
  grade?: string;
  issueDate?: string;
  expiryDate?: string;
}

interface StoreCtx extends State {
  activeUser: MockUser | null;
  setActiveUser: (u: MockUser | null) => void;

  createApplication: (templateId: string) => CredentialApplication | null;
  updateSharing: (credentialId: string, settings: Partial<SharingSettings>) => void;

  advanceApplicationStatus: (applicationId: string) => CredentialApplication | null;
  rejectApplication: (applicationId: string, reason: string) => void;
  addReviewerComment: (applicationId: string, text: string) => void;

  issueFromApplication: (applicationId: string) => IssuedCredential | null;
  directIssue: (
    templateId: string,
    recipients: { earnerId: string; grade?: string; expiryDate?: string }[],
    issueDate?: string,
  ) => IssuedCredential[];
  bulkIssue: (templateId: string, rows: BulkRow[]) => IssuedCredential[];
  revokeCredential: (credentialId: string, reason: string) => void;
  upsertTemplate: (t: MicroCredentialTemplate) => void;
  archiveTemplate: (id: string) => void;

  approveRegistration: (id: string) => void;
  rejectRegistration: (id: string) => void;

  markAllRead: (role: Role, userId?: string) => void;
  reset: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

function load(): State {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) } as State;
  } catch {
    return initialState;
  }
}
function loadUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function nowISO() {
  return new Date().toISOString();
}
function pushNotification(state: State, n: Omit<AppNotification, "id" | "createdAt" | "read">): State {
  return {
    ...state,
    notifications: [
      { ...n, id: `n-${uuid().slice(0, 8)}`, createdAt: nowISO(), read: false },
      ...state.notifications,
    ],
  };
}
function pushAudit(state: State, a: Omit<AuditEvent, "id" | "at">): State {
  return { ...state, audit: [{ ...a, id: `a-${uuid().slice(0, 8)}`, at: nowISO() }, ...state.audit] };
}
function pushEvent(state: State, e: Omit<PlatformEvent, "id" | "at">): State {
  return { ...state, events: [{ ...e, id: `p-${uuid().slice(0, 8)}`, at: nowISO() }, ...state.events] };
}
function addTimeline(app: CredentialApplication, ev: Omit<TimelineEvent, "id">): CredentialApplication {
  return {
    ...app,
    updatedAt: nowISO(),
    timeline: [...app.timeline, { ...ev, id: `t-${uuid().slice(0, 6)}` }],
  };
}

const defaultSharing: SharingSettings = {
  isPublic: true,
  showGrade: true,
  showSource: true,
  showExpiry: true,
  showSkills: true,
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [activeUser, setActiveUserState] = useState<MockUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setActiveUserState(loadUser());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setActiveUser = useCallback((u: MockUser | null) => {
    setActiveUserState(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem(ROLE_KEY, JSON.stringify(u));
      else localStorage.removeItem(ROLE_KEY);
    }
  }, []);

  const createApplication: StoreCtx["createApplication"] = useCallback(
    (templateId) => {
      let created: CredentialApplication | null = null;
      setState((s) => {
        const tpl = s.templates.find((t) => t.id === templateId);
        const earner = activeUser;
        if (!tpl || !earner) return s;
        const app: CredentialApplication = {
          id: `app-${uuid().slice(0, 6)}`,
          earnerId: earner.id,
          earnerName: earner.name,
          templateId: tpl.id,
          templateTitle: tpl.title,
          issuerId: tpl.issuerId,
          issuerName: tpl.issuerName,
          status: "submitted",
          reviewerComments: [],
          timeline: [
            { id: `t-${uuid().slice(0, 6)}`, at: nowISO(), actor: earner.name, action: "Application submitted" },
          ],
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        created = app;
        let next: State = { ...s, applications: [app, ...s.applications] };
        next = pushNotification(next, {
          forRole: "issuer",
          title: "New application submitted",
          body: `${earner.name} — ${tpl.title}`,
          link: "/issuer/requests",
        });
        next = pushAudit(next, { actor: earner.name, action: "submitted application", target: app.id });
        next = pushEvent(next, { type: "application", description: `${earner.name} applied for ${tpl.title}` });
        return next;
      });
      return created;
    },
    [activeUser],
  );

  const updateSharing: StoreCtx["updateSharing"] = useCallback((credentialId, settings) => {
    setState((s) => ({
      ...s,
      credentials: s.credentials.map((c) =>
        c.id === credentialId ? { ...c, sharing: { ...c.sharing, ...settings } } : c,
      ),
    }));
  }, []);

  const buildCredential = useCallback(
    (
      tpl: MicroCredentialTemplate,
      earner: { id: string; name: string },
      grade?: string,
      expiresAt?: string,
      issuedAt?: string,
    ): IssuedCredential => {
      const id = `cred-${uuid().slice(0, 6)}`;
      return {
        id,
        templateId: tpl.id,
        title: tpl.title,
        earnerId: earner.id,
        earnerName: earner.name,
        issuerId: tpl.issuerId,
        issuerName: tpl.issuerName,
        issuedAt: issuedAt ?? nowISO(),
        expiresAt,
        status: "active" as CredentialStatus,
        source: tpl.source,
        subcategory: tpl.subcategory,
        level: tpl.level,
        ects: tpl.ects,
        skills: tpl.skills,
        grade,
        verificationLink: `/verify/${id}`,
        shareToken: `share-${uuid().slice(0, 8)}`,
        sharing: defaultSharing,
        blockchain: { ebsiStatus: "not_anchored" },
      };
    },
    [],
  );

  const issueFromApplication: StoreCtx["issueFromApplication"] = useCallback(
    (appId) => {
      let issued: IssuedCredential | null = null;
      setState((s) => {
        const app = s.applications.find((a) => a.id === appId);
        if (!app) return s;
        const tpl = s.templates.find((t) => t.id === app.templateId);
        if (!tpl) return s;
        const cred = buildCredential(tpl, { id: app.earnerId, name: app.earnerName });
        issued = cred;
        const updatedApp = addTimeline(
          { ...app, status: "issued", resultingCredentialId: cred.id },
          { at: nowISO(), actor: activeUser?.name ?? "Issuer", action: "Credential issued" },
        );
        let next: State = {
          ...s,
          credentials: [cred, ...s.credentials],
          applications: s.applications.map((a) => (a.id === appId ? updatedApp : a)),
        };
        next = pushNotification(next, {
          forRole: "earner",
          forUserId: app.earnerId,
          title: "Credential issued",
          body: `${tpl.title} is now in your wallet.`,
          link: "/earner/credentials",
        });
        next = pushAudit(next, { actor: activeUser?.name ?? "Issuer", action: "issued credential", target: cred.id });
        next = pushEvent(next, { type: "issuance", description: `Credential ${cred.id} issued to ${app.earnerName}` });
        return next;
      });
      return issued;
    },
    [activeUser, buildCredential],
  );

  const advanceApplicationStatus: StoreCtx["advanceApplicationStatus"] = useCallback(
    (appId) => {
      let updated: CredentialApplication | null = null;
      const app = state.applications.find((a) => a.id === appId);
      if (!app) return null;
      const idx = LIFECYCLE_STAGES.indexOf(app.status);
      if (idx < 0 || idx >= LIFECYCLE_STAGES.length - 1) return null;
      const next = LIFECYCLE_STAGES[idx + 1];
      if (next === "issued") {
        issueFromApplication(appId);
        return state.applications.find((a) => a.id === appId) ?? null;
      }
      setState((s) => {
        const a = s.applications.find((x) => x.id === appId);
        if (!a) return s;
        const u = addTimeline(
          { ...a, status: next as RequestStatus },
          { at: nowISO(), actor: activeUser?.name ?? "Issuer", action: `Moved to ${next.replace(/_/g, " ")}` },
        );
        updated = u;
        return { ...s, applications: s.applications.map((x) => (x.id === appId ? u : x)) };
      });
      return updated;
    },
    [state.applications, activeUser, issueFromApplication],
  );

  const rejectApplication: StoreCtx["rejectApplication"] = useCallback((appId, reason) => {
    setState((s) => {
      const app = s.applications.find((a) => a.id === appId);
      if (!app) return s;
      const updated = addTimeline(
        { ...app, status: "rejected" },
        { at: nowISO(), actor: activeUser?.name ?? "Issuer", action: "Application rejected", detail: reason },
      );
      let next: State = { ...s, applications: s.applications.map((a) => (a.id === appId ? updated : a)) };
      next = pushNotification(next, {
        forRole: "earner",
        forUserId: app.earnerId,
        title: "Application rejected",
        body: `${app.templateTitle}: ${reason}`,
        link: "/earner/applications",
      });
      return next;
    });
  }, [activeUser]);

  const addReviewerComment: StoreCtx["addReviewerComment"] = useCallback((appId, text) => {
    setState((s) => ({
      ...s,
      applications: s.applications.map((a) =>
        a.id === appId
          ? { ...a, reviewerComments: [...a.reviewerComments, { author: activeUser?.name ?? "Issuer", at: nowISO(), text }] }
          : a,
      ),
    }));
  }, [activeUser]);

  const directIssue: StoreCtx["directIssue"] = useCallback(
    (templateId, recipients, issueDate) => {
      const issued: IssuedCredential[] = [];
      setState((s) => {
        const tpl = s.templates.find((t) => t.id === templateId);
        if (!tpl) return s;
        const newCreds = recipients
          .map((r) => {
            const u = s.users.find((x) => x.id === r.earnerId);
            if (!u) return null;
            return buildCredential(tpl, { id: u.id, name: u.name }, r.grade, r.expiryDate, issueDate);
          })
          .filter((c): c is IssuedCredential => !!c);
        issued.push(...newCreds);
        let next: State = { ...s, credentials: [...newCreds, ...s.credentials] };
        for (const c of newCreds) {
          next = pushNotification(next, {
            forRole: "earner",
            forUserId: c.earnerId,
            title: "Credential issued",
            body: `${c.title} is now in your wallet.`,
            link: "/earner/credentials",
          });
        }
        next = pushEvent(next, { type: "issuance", description: `${newCreds.length} credential(s) issued directly` });
        return next;
      });
      return issued;
    },
    [buildCredential],
  );

  const bulkIssue: StoreCtx["bulkIssue"] = useCallback(
    (templateId, rows) => {
      const issued: IssuedCredential[] = [];
      setState((s) => {
        const tpl = s.templates.find((t) => t.id === templateId);
        if (!tpl) return s;
        const newCreds = rows.map((r) => {
          const earnerId = `u-bulk-${uuid().slice(0, 6)}`;
          return buildCredential(tpl, { id: earnerId, name: `${r.firstName} ${r.lastName}` }, r.grade, r.expiryDate);
        });
        issued.push(...newCreds);
        let next: State = { ...s, credentials: [...newCreds, ...s.credentials] };
        next = pushEvent(next, { type: "issuance", description: `Bulk issuance: ${newCreds.length} credentials` });
        return next;
      });
      return issued;
    },
    [buildCredential],
  );

  const revokeCredential: StoreCtx["revokeCredential"] = useCallback((id, reason) => {
    setState((s) => {
      let next: State = {
        ...s,
        credentials: s.credentials.map((c) =>
          c.id === id ? { ...c, status: "revoked", revocationReason: reason } : c,
        ),
      };
      const cred = s.credentials.find((c) => c.id === id);
      if (cred) {
        next = pushNotification(next, {
          forRole: "earner",
          forUserId: cred.earnerId,
          title: "Credential revoked",
          body: `${cred.title}: ${reason}`,
          link: "/earner/credentials",
        });
        next = pushEvent(next, { type: "revocation", description: `Credential ${id} revoked` });
      }
      return next;
    });
  }, []);

  const upsertTemplate: StoreCtx["upsertTemplate"] = useCallback((t) => {
    setState((s) => {
      const exists = s.templates.some((x) => x.id === t.id);
      return {
        ...s,
        templates: exists ? s.templates.map((x) => (x.id === t.id ? t : x)) : [t, ...s.templates],
      };
    });
  }, []);

  const archiveTemplate: StoreCtx["archiveTemplate"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      templates: s.templates.map((t) => (t.id === id ? { ...t, status: "archived" } : t)),
    }));
  }, []);

  const approveRegistration: StoreCtx["approveRegistration"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      registrations: s.registrations.map((r) => (r.id === id ? { ...r, status: "approved" } : r)),
    }));
  }, []);
  const rejectRegistration: StoreCtx["rejectRegistration"] = useCallback((id) => {
    setState((s) => ({
      ...s,
      registrations: s.registrations.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)),
    }));
  }, []);

  const markAllRead: StoreCtx["markAllRead"] = useCallback((role, userId) => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.forRole === role && (!n.forUserId || n.forUserId === userId) ? { ...n, read: true } : n,
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(KEY);
    setState(initialState);
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      ...state,
      activeUser,
      setActiveUser,
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
      approveRegistration,
      rejectRegistration,
      markAllRead,
      reset,
    }),
    [
      state, activeUser, setActiveUser, createApplication, updateSharing,
      advanceApplicationStatus, rejectApplication, addReviewerComment,
      issueFromApplication, directIssue, bulkIssue, revokeCredential,
      upsertTemplate, archiveTemplate, approveRegistration, rejectRegistration,
      markAllRead, reset,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { mockUsers };
