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
      credentials: {
        Row: {
          created_at: string
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
          level: Database["public"]["Enums"]["cred_level"]
          renewed_from_id: string | null
          revocation_reason: string | null
          share_is_public: boolean
          share_show_expiry: boolean
          share_show_grade: boolean
          share_show_skills: boolean
          share_show_source: boolean
          share_token: string
          skills: string[]
          source: Database["public"]["Enums"]["learning_source"]
          status: Database["public"]["Enums"]["credential_status"]
          subcategory:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
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
          level?: Database["public"]["Enums"]["cred_level"]
          renewed_from_id?: string | null
          revocation_reason?: string | null
          share_is_public?: boolean
          share_show_expiry?: boolean
          share_show_grade?: boolean
          share_show_skills?: boolean
          share_show_source?: boolean
          share_token?: string
          skills?: string[]
          source: Database["public"]["Enums"]["learning_source"]
          status?: Database["public"]["Enums"]["credential_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
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
          level?: Database["public"]["Enums"]["cred_level"]
          renewed_from_id?: string | null
          revocation_reason?: string | null
          share_is_public?: boolean
          share_show_expiry?: boolean
          share_show_grade?: boolean
          share_show_skills?: boolean
          share_show_source?: boolean
          share_token?: string
          skills?: string[]
          source?: Database["public"]["Enums"]["learning_source"]
          status?: Database["public"]["Enums"]["credential_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          template_id?: string
          title?: string
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
            foreignKeyName: "credentials_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
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
      templates: {
        Row: {
          assessment: string
          country: string
          created_at: string
          created_by: string | null
          description: string
          ects: number | null
          expiry_rule: string | null
          further_info: string | null
          id: string
          issuer_id: string
          level: Database["public"]["Enums"]["cred_level"]
          outcomes: string[]
          participation: Database["public"]["Enums"]["participation"]
          prerequisites: string
          quality_assurance: string
          required_evidence: Database["public"]["Enums"]["evidence_type"][]
          skills: string[]
          source: Database["public"]["Enums"]["learning_source"]
          stackability: string
          status: Database["public"]["Enums"]["template_status"]
          subcategory:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          supervision: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          assessment?: string
          country: string
          created_at?: string
          created_by?: string | null
          description?: string
          ects?: number | null
          expiry_rule?: string | null
          further_info?: string | null
          id?: string
          issuer_id: string
          level?: Database["public"]["Enums"]["cred_level"]
          outcomes?: string[]
          participation?: Database["public"]["Enums"]["participation"]
          prerequisites?: string
          quality_assurance?: string
          required_evidence?: Database["public"]["Enums"]["evidence_type"][]
          skills?: string[]
          source: Database["public"]["Enums"]["learning_source"]
          stackability?: string
          status?: Database["public"]["Enums"]["template_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          supervision?: string
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          assessment?: string
          country?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ects?: number | null
          expiry_rule?: string | null
          further_info?: string | null
          id?: string
          issuer_id?: string
          level?: Database["public"]["Enums"]["cred_level"]
          outcomes?: string[]
          participation?: Database["public"]["Enums"]["participation"]
          prerequisites?: string
          quality_assurance?: string
          required_evidence?: Database["public"]["Enums"]["evidence_type"][]
          skills?: string[]
          source?: Database["public"]["Enums"]["learning_source"]
          stackability?: string
          status?: Database["public"]["Enums"]["template_status"]
          subcategory?:
            | Database["public"]["Enums"]["non_formal_subcategory"]
            | null
          supervision?: string
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
      get_public_credential: {
        Args: { _share_token: string }
        Returns: {
          earner_name: string
          ebsi_status: string
          ects: number
          expires_at: string
          grade: string
          id: string
          issued_at: string
          issuer_name: string
          level: Database["public"]["Enums"]["cred_level"]
          skills: string[]
          source: Database["public"]["Enums"]["learning_source"]
          status: Database["public"]["Enums"]["credential_status"]
          title: string
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
    }
    Enums: {
      app_role: "platform_admin" | "issuer_admin" | "earner" | "verifier"
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
      app_role: ["platform_admin", "issuer_admin", "earner", "verifier"],
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
