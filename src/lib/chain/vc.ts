// Builds a canonical W3C-style Verifiable Credential JSON snapshot
// that is hashed and stored alongside each issued credential.

export interface VcInput {
  credentialId: string;
  title: string;
  templateId: string | null;
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
}

export function buildVcJson(input: VcInput): Record<string, unknown> {
  return {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://europass.eu/ns/credential/v1",
    ],
    id: `urn:microcred:${input.credentialId}`,
    type: ["VerifiableCredential", "MicroCredential"],
    issuer: {
      id: `urn:issuer:${input.issuerId}`,
      name: input.issuerName,
    },
    issuanceDate: input.issuedAt,
    expirationDate: input.expiresAt ?? null,
    credentialSubject: {
      id: `urn:earner:${input.earnerId}`,
      name: input.earnerName,
      achievement: {
        id: input.templateId ? `urn:template:${input.templateId}` : undefined,
        name: input.title,
        level: input.level ?? null,
        ects: input.ects ?? null,
        skills: input.skills ?? [],
        grade: input.grade ?? null,
        source: input.source ?? null,
        subcategory: input.subcategory ?? null,
      },
      euMetadata: {
        qaType: input.qaType ?? null,
        supervisionType: input.supervisionType ?? null,
        stackabilityType: input.stackabilityType ?? null,
        prerequisites: input.prerequisitesNone ? null : input.prerequisites ?? null,
        prerequisitesNone: !!input.prerequisitesNone,
      },
    },
  };
}
