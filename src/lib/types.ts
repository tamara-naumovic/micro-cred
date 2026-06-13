// Domain model for Micro-Credential Platform v3
// Single-issuer flow: no Course Provider role, no learner-uploaded evidence.

export type Role = "earner" | "issuer" | "admin";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  // For Issuer role only: distinguishes institution admin from staff employee
  subRole?: "admin" | "staff";
  organizationId?: string;
  organization?: string;
  studentId?: string;
}

export interface TemplateAssignment {
  templateId: string;
  userId: string;
}

export type LearningSource = "formal" | "non_formal";

export type NonFormalSubcategory =
  | "extracurricular"
  | "volunteering"
  | "workshop_bootcamp"
  | "competition_hackathon"
  | "project_based"
  | "professional_training"
  | "student_org"
  | "research_innovation"
  | "other";

export type Participation = "online" | "onsite" | "hybrid" | "blended" | "self_paced";

export type TemplateStatus = "draft" | "active" | "archived";

// Lifecycle stages the issuer clicks through. The earner sees this as a
// read-only timeline.
export type RequestStatus =
  | "submitted"
  | "in_review"
  | "evidence_collected"
  | "verified_by_provider"
  | "issued"
  | "rejected";

export const LIFECYCLE_STAGES: RequestStatus[] = [
  "submitted",
  "in_review",
  "evidence_collected",
  "verified_by_provider",
  "issued",
];

export type CredentialStatus =
  | "active"
  | "pending"
  | "processing"
  | "expired"
  | "revoked"
  | "renewed";

export type Level = "Foundation" | "Intermediate" | "Advanced" | "Expert" | "N/A";

export interface Organization {
  id: string;
  name: string;
  type: "issuer";
  country: string;
  about?: string;
  website?: string;
  accreditations?: string[];
  registeredAt: string;
}

export interface MicroCredentialTemplate {
  id: string;
  title: string;
  description: string;
  issuerId: string;
  issuerName: string;
  country: string;
  source: LearningSource;
  subcategory?: NonFormalSubcategory;
  outcomes: string[];
  skills: string[];
  ects?: number;
  level: Level;
  assessment: string;
  participation: Participation;
  qualityAssurance: string;
  prerequisites: string;
  supervision: string;
  stackability: string;
  furtherInfo?: string;
  expiryRule?: string;
  status: TemplateStatus;
  version: string;
}

export interface BlockchainPlaceholder {
  did?: string;
  vcId?: string;
  txHash?: string;
  ebsiStatus: "not_anchored" | "pending" | "anchored";
}

export interface SharingSettings {
  isPublic: boolean;
  showGrade: boolean;
  showSource: boolean;
  showExpiry: boolean;
  showSkills: boolean;
}

export interface IssuedCredential {
  id: string;
  templateId: string;
  title: string;
  earnerId: string;
  earnerName: string;
  issuerId: string;
  issuerName: string;
  issuedAt: string;
  expiresAt?: string;
  status: CredentialStatus;
  source: LearningSource;
  subcategory?: NonFormalSubcategory;
  level: Level;
  ects?: number;
  skills: string[];
  grade?: string;
  verificationLink: string;
  shareToken?: string;
  sharing: SharingSettings;
  blockchain: BlockchainPlaceholder;
  revocationReason?: string;
  renewedFromId?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface CredentialApplication {
  id: string;
  earnerId: string;
  earnerName: string;
  templateId: string;
  templateTitle: string;
  issuerId: string;
  issuerName: string;
  status: RequestStatus;
  reviewerComments: { author: string; at: string; text: string }[];
  timeline: TimelineEvent[];
  createdAt: string;
  updatedAt: string;
  resultingCredentialId?: string;
}

export interface AppNotification {
  id: string;
  forRole: Role;
  forUserId?: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface RegistrationRequest {
  id: string;
  type: "issuer";
  organizationName: string;
  contactName: string;
  contactEmail: string;
  country: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

export interface PlatformEvent {
  id: string;
  at: string;
  type: "issuance" | "registration" | "revocation" | "application" | "login";
  description: string;
}
