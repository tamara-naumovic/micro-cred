// Builds canonical W3C-style Verifiable Credential JSON snapshots and
// canonical Template payload snapshots. Both feed into SHA-256 document hashing.

export interface VcInput {
  credentialId: string;
  vcId: string;
  title: string;
  templateId: string | null;
  templateVersion: string | null;
  templateRef: string | null;
  earnerId: string;
  earnerName: string;
  issuerId: string;
  issuerName: string;
  issuedAt: string;
  expiresAt?: string | null;
  source?: string | null;
  subcategory?: string | null;
  level?: string | null;
  ects?: number | null;
  skills?: string[] | null;
  grade?: string | null;
  qaType?: string | null;
  supervisionType?: string | null;
  stackabilityType?: string | null;
  prerequisites?: string | null;
  prerequisitesNone?: boolean | null;
  outcomes?: string[] | null;
  assessment?: string | null;
  participation?: string | null;
  furtherInfo?: string | null;
}

export function buildVcJson(input: VcInput): Record<string, unknown> {
  return {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://europass.eu/ns/credential/v1",
    ],
    id: input.vcId || `urn:microcred:${input.credentialId}`,
    type: ["VerifiableCredential", "MicroCredential"],
    issuer: { id: `urn:issuer:${input.issuerId}`, name: input.issuerName },
    issuanceDate: input.issuedAt,
    expirationDate: input.expiresAt ?? null,
    credentialSubject: {
      id: `urn:earner:${input.earnerId}`,
      name: input.earnerName,
      achievement: {
        id: input.templateId ? `urn:template:${input.templateId}` : undefined,
        templateVersion: input.templateVersion ?? null,
        templateRef: input.templateRef ?? null,
        name: input.title,
        level: input.level ?? null,
        ects: input.ects ?? null,
        skills: input.skills ?? [],
        grade: input.grade ?? null,
        source: input.source ?? null,
        subcategory: input.subcategory ?? null,
        assessment: input.assessment ?? null,
        participation: input.participation ?? null,
        outcomes: input.outcomes ?? [],
      },
      euMetadata: {
        qaType: input.qaType ?? null,
        supervisionType: input.supervisionType ?? null,
        stackabilityType: input.stackabilityType ?? null,
        prerequisites: input.prerequisitesNone ? null : input.prerequisites ?? null,
        prerequisitesNone: !!input.prerequisitesNone,
        furtherInfo: input.furtherInfo ?? null,
      },
    },
  };
}

export interface TemplateInput {
  templateId: string;
  version: string;
  issuerId: string;
  issuerName: string;
  title: string;
  description: string;
  source: string;
  subcategory: string | null;
  level: string;
  participation: string;
  ects: number | null;
  skills: string[];
  outcomes: string[];
  assessment: string;
  qaType: string;
  prerequisites: string | null;
  prerequisitesNone: boolean;
  supervisionType: string | null;
  stackabilityType: string | null;
  expiryMode: string;
  expiryDate: string | null;
  furtherInfo?: string | null;
}

export function buildTemplateCanonicalPayload(input: TemplateInput): Record<string, unknown> {
  return {
    type: ["MicroCredentialTemplate"],
    id: `urn:template:${input.templateId}`,
    version: input.version,
    issuer: { id: `urn:issuer:${input.issuerId}`, name: input.issuerName },
    title: input.title,
    description: input.description,
    source: input.source,
    subcategory: input.subcategory,
    level: input.level,
    participation: input.participation,
    ects: input.ects,
    skills: [...input.skills].sort(),
    outcomes: input.outcomes,
    assessment: input.assessment,
    qualityAssurance: { type: input.qaType },
    prerequisites: input.prerequisitesNone ? null : input.prerequisites,
    prerequisitesNone: input.prerequisitesNone,
    supervisionType: input.supervisionType,
    stackabilityType: input.stackabilityType,
    expiration: {
      mode: input.expiryMode,
      date: input.expiryMode === "fixed_date" ? input.expiryDate : null,
    },
    furtherInfo: input.furtherInfo ?? null,
  };
}
