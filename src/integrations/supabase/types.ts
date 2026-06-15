export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_comments: {
        Row: {
          application_id: string
          author_id: string | null
          author_name: string
          created_at: string
          id: string
          text: string
        }
        Insert: {
          application_id: string
          author_id?: string | null
          author_name: string
          created_at?: string
          id?: string
          text: string
        }
        Update: {
          application_id?: string
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_comments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_timeline: {
        Row: {
          action: string
          actor_name: string
          application_id: string
          created_at: string
          detail: string | null
          id: string
        }
        Insert: {
          action: string
          actor_name: string
          application_id: string
          created_at?: string
          detail?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_name?: string
          application_id?: string
          created_at?: string
          detail?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_timeline_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          earner_id: string
          id: string
          issuer_id: string
          resulting_credential_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          earner_id: string
          id?: string
          issuer_id: string
          resulting_credential_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          earner_id?: string
          id?: string
          issuer_id?: string
          resulting_credential_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_resulting_cred_fk"
            columns: ["resulting_credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          created_at: string
          id: string
          target: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          created_at?: string
          id?: string
          target: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          id?: string
          target?: string
        }
        Relationships: []
      }
      chain_anchor_jobs: {
        Row: {
          attempts: number
          created_at: string
          credential_id: string | null
          entity_id: string | null
          entity_type: string
          id: string
          last_error: string | null
          next_attempt_at: string | null
          operation: string
          status: string
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          credential_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          operation?: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          credential_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          operation?: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_anchor_jobs_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_anchor_jobs: {
        Row: {
          attempts: number
          created_at: string
          credential_id: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string | null
          operation: string
          status: string
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          credential_id: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          operation?: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          credential_id?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          operation?: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_anchor_jobs_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_blockchain_records: {
        Row: {
          anchored_at: string | null
          attempt_count: number
          block_number: number | null
          blockchain_status: string
          chain_id: number
          contract_address: string
          contract_credential_id: string | null
          created_at: string
          credential_id: string
          document_hash: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          network: string
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          anchored_at?: string | null
          attempt_count?: number
          block_number?: number | null
          blockchain_status?: string
          chain_id?: number
          contract_address?: string
          contract_credential_id?: string | null
          created_at?: string
          credential_id: string
          document_hash: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          network?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          anchored_at?: string | null
          attempt_count?: number
          block_number?: number | null
          blockchain_status?: string
          chain_id?: number
          contract_address?: string
          contract_credential_id?: string | null
          created_at?: string
          credential_id?: string
          document_hash?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          network?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_blockchain_records_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          accepted_at: string | null
          canonical_payload: Json | null
          chain_attempts: number
          chain_block_number: number | null
          chain_confirmed_at: string | null
          chain_contract_address: string | null
          chain_error: string | null
          chain_issuer_address: string | null
          chain_last_attempt_at: string | null
          chain_status: string
          chain_submitted_at: string | null
          chain_tx_hash: string | null
          created_at: string
          credential_hash: string | null
          credential_lifecycle: string
          earner_id: string
          earner_name: string
          ebsi_did: string | null
          ebsi_status: string
          ebsi_tx_hash: string | null
          ebsi_vc_id: string | null
          ects: number | null
          expires_at: string | null
          grade: string | null
          id: string
          issued_at: string
          issuer_id: string
          issuer_name: string
          issuer_name_snapshot: string | null
          learner_commitment: string | null
          learner_secret: string | null
          level: Database["public"]["Enums"]["cred_level"]
          pdf_storage_path: string | null
          rejected_at: string | null
          rejection_reason: string | null
          renewed_from_id: string | null
          revocation_reason: string | null
          share_is_public: boolean
          share_show_expiry: boolean
          share_show_grade: boolean
          share_show_integration: boolean
          share_show_level: boolean
          share_show_prerequisites: boolean
          share_show_skills: boolean
          share_show_source: boolean
          share_show_supervision: boolean
          share_token: string
          skills: string[]
          source: Database["public"]["Enums"]["learning_source"]
          status: Database["public"]["Enums"]["credential_status"]
          subcategory:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          superseded_by_id: string | null
          template_id: string
          template_ref: string | null
          template_version: string | null
          title: string
          vc_id: string | null
          vc_json: Json | null
        }
        Insert: {
          accepted_at?: string | null
          canonical_payload?: Json | null
          chain_attempts?: number
          chain_block_number?: number | null
          chain_confirmed_at?: string | null
          chain_contract_address?: string | null
          chain_error?: string | null
          chain_issuer_address?: string | null
          chain_last_attempt_at?: string | null
          chain_status?: string
          chain_submitted_at?: string | null
          chain_tx_hash?: string | null
          created_at?: string
          credential_hash?: string | null
          credential_lifecycle?: string
          earner_id: string
          earner_name: string
          ebsi_did?: string | null
          ebsi_status?: string
          ebsi_tx_hash?: string | null
          ebsi_vc_id?: string | null
          ects?: number | null
          expires_at?: string | null
          grade?: string | null
          id?: string
          issued_at?: string
          issuer_id: string
          issuer_name: string
          issuer_name_snapshot?: string | null
          learner_commitment?: string | null
          learner_secret?: string | null
          level?: Database["public"]["Enums"]["cred_level"]
          pdf_storage_path?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          renewed_from_id?: string | null
          revocation_reason?: string | null
          share_is_public?: boolean
          share_show_expiry?: boolean
          share_show_grade?: boolean
          share_show_integration?: boolean
          share_show_level?: boolean
          share_show_prerequisites?: boolean
          share_show_skills?: boolean
          share_show_source?: boolean
          share_show_supervision?: boolean
          share_token?: string
          skills?: string[]
          source: Database["public"]["Enums"]["learning_source"]
          status?: Database["public"]["Enums"]["credential_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          superseded_by_id?: string | null
          template_id: string
          template_ref?: string | null
          template_version?: string | null
          title: string
          vc_id?: string | null
          vc_json?: Json | null
        }
        Update: {
          accepted_at?: string | null
          canonical_payload?: Json | null
          chain_attempts?: number
          chain_block_number?: number | null
          chain_confirmed_at?: string | null
          chain_contract_address?: string | null
          chain_error?: string | null
          chain_issuer_address?: string | null
          chain_last_attempt_at?: string | null
          chain_status?: string
          chain_submitted_at?: string | null
          chain_tx_hash?: string | null
          created_at?: string
          credential_hash?: string | null
          credential_lifecycle?: string
          earner_id?: string
          earner_name?: string
          ebsi_did?: string | null
          ebsi_status?: string
          ebsi_tx_hash?: string | null
          ebsi_vc_id?: string | null
          ects?: number | null
          expires_at?: string | null
          grade?: string | null
          id?: string
          issued_at?: string
          issuer_id?: string
          issuer_name?: string
          issuer_name_snapshot?: string | null
          learner_commitment?: string | null
          learner_secret?: string | null
          level?: Database["public"]["Enums"]["cred_level"]
          pdf_storage_path?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          renewed_from_id?: string | null
          revocation_reason?: string | null
          share_is_public?: boolean
          share_show_expiry?: boolean
          share_show_grade?: boolean
          share_show_integration?: boolean
          share_show_level?: boolean
          share_show_prerequisites?: boolean
          share_show_skills?: boolean
          share_show_source?: boolean
          share_show_supervision?: boolean
          share_token?: string
          skills?: string[]
          source?: Database["public"]["Enums"]["learning_source"]
          status?: Database["public"]["Enums"]["credential_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          superseded_by_id?: string | null
          template_id?: string
          template_ref?: string | null
          template_version?: string | null
          title?: string
          vc_id?: string | null
          vc_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      earner_institutions: {
        Row: {
          assigned_by: string | null
          created_at: string
          earner_id: string
          id: string
          organization_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          earner_id: string
          id?: string
          organization_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          earner_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earner_institutions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          for_org_id: string | null
          for_role: Database["public"]["Enums"]["app_role"] | null
          for_user_id: string | null
          id: string
          link: string | null
          read: boolean
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          for_org_id?: string | null
          for_role?: Database["public"]["Enums"]["app_role"] | null
          for_user_id?: string | null
          id?: string
          link?: string | null
          read?: boolean
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          for_org_id?: string | null
          for_role?: Database["public"]["Enums"]["app_role"] | null
          for_user_id?: string | null
          id?: string
          link?: string | null
          read?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_for_org_id_fkey"
            columns: ["for_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          about: string | null
          accreditation_document_url: string | null
          accreditations: string[]
          country: string
          created_at: string
          id: string
          name: string
          registered_at: string
          type: Database["public"]["Enums"]["organization_type"]
          website: string | null
        }
        Insert: {
          about?: string | null
          accreditation_document_url?: string | null
          accreditations?: string[]
          country: string
          created_at?: string
          id?: string
          name: string
          registered_at?: string
          type: Database["public"]["Enums"]["organization_type"]
          website?: string | null
        }
        Update: {
          about?: string | null
          accreditation_document_url?: string | null
          accreditations?: string[]
          country?: string
          created_at?: string
          id?: string
          name?: string
          registered_at?: string
          type?: Database["public"]["Enums"]["organization_type"]
          website?: string | null
        }
        Relationships: []
      }
      platform_events: {
        Row: {
          created_at: string
          description: string
          id: string
          type: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about: string | null
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          share_token: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          email: string
          id: string
          share_token?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          share_token?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registration_requests: {
        Row: {
          applicant_user_id: string | null
          contact_email: string
          contact_name: string
          country: string
          id: string
          message: string | null
          organization_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"]
          submitted_at: string
          type: Database["public"]["Enums"]["organization_type"]
        }
        Insert: {
          applicant_user_id?: string | null
          contact_email: string
          contact_name: string
          country: string
          id?: string
          message?: string | null
          organization_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          submitted_at?: string
          type: Database["public"]["Enums"]["organization_type"]
        }
        Update: {
          applicant_user_id?: string | null
          contact_email?: string
          contact_name?: string
          country?: string
          id?: string
          message?: string | null
          organization_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          submitted_at?: string
          type?: Database["public"]["Enums"]["organization_type"]
        }
        Relationships: []
      }
      template_anchor_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string | null
          operation: string
          status: string
          template_id: string
          template_version: string
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          operation?: string
          status?: string
          template_id: string
          template_version: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          operation?: string
          status?: string
          template_id?: string
          template_version?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_anchor_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_assignees: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_assignees_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_blockchain_records: {
        Row: {
          anchored_at: string | null
          attempt_count: number
          block_number: number | null
          blockchain_status: string
          chain_id: number
          contract_address: string
          created_at: string
          document_hash: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          network: string
          template_id: string
          template_ref: string
          template_version: string
          transaction_hash: string | null
          updated_at: string
        }
        Insert: {
          anchored_at?: string | null
          attempt_count?: number
          block_number?: number | null
          blockchain_status?: string
          chain_id?: number
          contract_address?: string
          created_at?: string
          document_hash: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          network?: string
          template_id: string
          template_ref: string
          template_version: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Update: {
          anchored_at?: string | null
          attempt_count?: number
          block_number?: number | null
          blockchain_status?: string
          chain_id?: number
          contract_address?: string
          created_at?: string
          document_hash?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          network?: string
          template_id?: string
          template_ref?: string
          template_version?: string
          transaction_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_blockchain_records_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          canonical_payload: Json
          created_at: string
          document_hash: string
          id: string
          issuer_name_snapshot: string
          published_at: string
          published_by: string | null
          template_id: string
          template_ref: string
          version: string
        }
        Insert: {
          canonical_payload: Json
          created_at?: string
          document_hash: string
          id?: string
          issuer_name_snapshot: string
          published_at?: string
          published_by?: string | null
          template_id: string
          template_ref: string
          version: string
        }
        Update: {
          canonical_payload?: Json
          created_at?: string
          document_hash?: string
          id?: string
          issuer_name_snapshot?: string
          published_at?: string
          published_by?: string | null
          template_id?: string
          template_ref?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          assessment: string
          blockchain_status: string
          canonical_payload: Json | null
          country: string
          created_at: string
          created_by: string | null
          description: string
          document_hash: string | null
          ects: number | null
          expiry_date: string | null
          expiry_mode: string
          expiry_rule: string | null
          further_info: string | null
          id: string
          issuer_id: string
          issuer_name_snapshot: string | null
          level: Database["public"]["Enums"]["cred_level"]
          outcomes: string[]
          participation: Database["public"]["Enums"]["participation"]
          prerequisites: string
          prerequisites_none: boolean
          published_at: string | null
          published_by: string | null
          qa_document_path: string | null
          qa_document_paths: string[]
          qa_type: string
          quality_assurance: string
          required_evidence: Database["public"]["Enums"]["evidence_type"][]
          skills: string[]
          source: Database["public"]["Enums"]["learning_source"]
          stackability: string
          stackability_type: string | null
          status: Database["public"]["Enums"]["template_status"]
          subcategory:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          supervision: string
          supervision_type: string | null
          template_ref: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          assessment?: string
          blockchain_status?: string
          canonical_payload?: Json | null
          country: string
          created_at?: string
          created_by?: string | null
          description?: string
          document_hash?: string | null
          ects?: number | null
          expiry_date?: string | null
          expiry_mode?: string
          expiry_rule?: string | null
          further_info?: string | null
          id?: string
          issuer_id: string
          issuer_name_snapshot?: string | null
          level?: Database["public"]["Enums"]["cred_level"]
          outcomes?: string[]
          participation?: Database["public"]["Enums"]["participation"]
          prerequisites?: string
          prerequisites_none?: boolean
          published_at?: string | null
          published_by?: string | null
          qa_document_path?: string | null
          qa_document_paths?: string[]
          qa_type?: string
          quality_assurance?: string
          required_evidence?: Database["public"]["Enums"]["evidence_type"][]
          skills?: string[]
          source: Database["public"]["Enums"]["learning_source"]
          stackability?: string
          stackability_type?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          supervision?: string
          supervision_type?: string | null
          template_ref?: string | null
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          assessment?: string
          blockchain_status?: string
          canonical_payload?: Json | null
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string
          document_hash?: string | null
          ects?: number | null
          expiry_date?: string | null
          expiry_mode?: string
          expiry_rule?: string | null
          further_info?: string | null
          id?: string
          issuer_id?: string
          issuer_name_snapshot?: string | null
          level?: Database["public"]["Enums"]["cred_level"]
          outcomes?: string[]
          participation?: Database["public"]["Enums"]["participation"]
          prerequisites?: string
          prerequisites_none?: boolean
          published_at?: string | null
          published_by?: string | null
          qa_document_path?: string | null
          qa_document_paths?: string[]
          qa_type?: string
          quality_assurance?: string
          required_evidence?: Database["public"]["Enums"]["evidence_type"][]
          skills?: string[]
          source?: Database["public"]["Enums"]["learning_source"]
          stackability?: string
          stackability_type?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          supervision?: string
          supervision_type?: string | null
          template_ref?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_issuer_id_fkey"
            columns: ["issuer_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_application: { Args: { _app_id: string }; Returns: boolean }
      get_credential_visibility: {
        Args: { _share_token: string }
        Returns: {
          exists_flag: boolean
          is_public: boolean
        }[]
      }
      get_public_credential: {
        Args: { _share_token: string }
        Returns: {
          chain_block_number: number
          chain_contract_address: string
          chain_issuer_address: string
          chain_status: string
          chain_tx_hash: string
          credential_hash: string
          credential_lifecycle: string
          earner_name: string
          ebsi_status: string
          ects: number
          expires_at: string
          grade: string
          id: string
          issued_at: string
          issuer_name: string
          learner_commitment: string
          level: Database["public"]["Enums"]["cred_level"]
          prerequisites: string
          prerequisites_none: boolean
          qa_document_path: string
          qa_type: string
          skills: string[]
          source: Database["public"]["Enums"]["learning_source"]
          stackability_type: string
          status: Database["public"]["Enums"]["credential_status"]
          supervision_type: string
          template_ref: string
          template_version: string
          title: string
          vc_id: string
        }[]
      }
      get_public_profile: {
        Args: { _share_token: string }
        Returns: {
          about: string
          avatar_url: string
          country: string
          credentials: Json
          display_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_org: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_template_assignee: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      template_issuer_org: { Args: { _template_id: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "platform_admin"
        | "issuer_admin"
        | "earner"
        | "verifier"
        | "issuer_staff"
      cred_level: "Foundation" | "Intermediate" | "Advanced" | "Expert" | "N/A"
      credential_status:
        | "active"
        | "pending"
        | "processing"
        | "expired"
        | "revoked"
        | "renewed"
      evidence_status: "pending" | "approved" | "rejected" | "changes_requested"
      evidence_type:
        | "file"
        | "url"
        | "text"
        | "lms_record"
        | "grade_record"
        | "repo"
        | "external_certificate"
        | "attendance"
        | "competition_result"
        | "supervisor_confirmation"
        | "portfolio"
      learning_source: "formal" | "non_formal"
      non_formal_subcategory:
        | "extracurricular"
        | "volunteering"
        | "workshop_bootcamp"
        | "competition_hackathon"
        | "project_based"
        | "professional_training"
        | "student_org"
        | "research_innovation"
        | "other"
      organization_type: "issuer" | "provider"
      participation: "online" | "onsite" | "hybrid" | "blended" | "self_paced"
      registration_status: "pending" | "approved" | "rejected"
      request_status:
        | "submitted"
        | "in_review"
        | "evidence_collected"
        | "verified_by_provider"
        | "issued"
        | "rejected"
      template_status: "draft" | "active" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "platform_admin",
        "issuer_admin",
        "earner",
        "verifier",
        "issuer_staff",
      ],
      cred_level: ["Foundation", "Intermediate", "Advanced", "Expert", "N/A"],
      credential_status: [
        "active",
        "pending",
        "processing",
        "expired",
        "revoked",
        "renewed",
      ],
      evidence_status: ["pending", "approved", "rejected", "changes_requested"],
      evidence_type: [
        "file",
        "url",
        "text",
        "lms_record",
        "grade_record",
        "repo",
        "external_certificate",
        "attendance",
        "competition_result",
        "supervisor_confirmation",
        "portfolio",
      ],
      learning_source: ["formal", "non_formal"],
      non_formal_subcategory: [
        "extracurricular",
        "volunteering",
        "workshop_bootcamp",
        "competition_hackathon",
        "project_based",
        "professional_training",
        "student_org",
        "research_innovation",
        "other",
      ],
      organization_type: ["issuer", "provider"],
      participation: ["online", "onsite", "hybrid", "blended", "self_paced"],
      registration_status: ["pending", "approved", "rejected"],
      request_status: [
        "submitted",
        "in_review",
        "evidence_collected",
        "verified_by_provider",
        "issued",
        "rejected",
      ],
      template_status: ["draft", "active", "archived"],
    },
  },
} as const
