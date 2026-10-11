// Generated from the migrated schema with @supabase/postgres-meta (GET /generators/typescript?included_schemas=public).
// Regenerate after every migration: 'supabase gen types typescript --project-id <ref> > src/types/database.ts'.
// Do not edit by hand.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string | null
          cover_image_path: string | null
          created_at: string
          created_by: string | null
          description_bn: string | null
          description_en: string | null
          general_location: string | null
          id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          slug: string
          title_bn: string | null
          title_en: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          activity_date?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description_bn?: string | null
          description_en?: string | null
          general_location?: string | null
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          slug: string
          title_bn?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          activity_date?: string | null
          cover_image_path?: string | null
          created_at?: string
          created_by?: string | null
          description_bn?: string | null
          description_en?: string | null
          general_location?: string | null
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          slug?: string
          title_bn?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["audience_type"]
          content_bn: string | null
          content_en: string | null
          created_at: string
          created_by: string | null
          id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          published_at: string | null
          title_bn: string | null
          title_en: string | null
        }
        ComputedFields: never
        Insert: {
          audience?: Database["public"]["Enums"]["audience_type"]
          content_bn?: string | null
          content_en?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          title_bn?: string | null
          title_en?: string | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_type"]
          content_bn?: string | null
          content_en?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          published_at?: string | null
          title_bn?: string | null
          title_en?: string | null
        }
        Relationships: []
      }
      assistance_records: {
        Row: {
          approved_amount: number
          approved_by: string | null
          assistance_date: string | null
          assistance_type: string
          beneficiary_id: string
          created_at: string
          created_by: string | null
          disbursed_amount: number
          fund_id: string
          id: string
          privacy_level: Database["public"]["Enums"]["privacy_level"]
          status: Database["public"]["Enums"]["assistance_status"]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          approved_amount?: number
          approved_by?: string | null
          assistance_date?: string | null
          assistance_type: string
          beneficiary_id: string
          created_at?: string
          created_by?: string | null
          disbursed_amount?: number
          fund_id: string
          id?: string
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          status?: Database["public"]["Enums"]["assistance_status"]
          updated_at?: string
        }
        Update: {
          approved_amount?: number
          approved_by?: string | null
          assistance_date?: string | null
          assistance_type?: string
          beneficiary_id?: string
          created_at?: string
          created_by?: string | null
          disbursed_amount?: number
          fund_id?: string
          id?: string
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          status?: Database["public"]["Enums"]["assistance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistance_records_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistance_records_fund_id_fkey"
            columns: ["fund_id"]
            referencedRelation: "fund_balances"
            referencedColumns: ["fund_id"]
          },
          {
            foreignKeyName: "assistance_records_fund_id_fkey"
            columns: ["fund_id"]
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: NonNullable<Json>
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: NonNullable<Json>
        }
        Relationships: []
      }
      beneficiaries: {
        Row: {
          address_detail: string | null
          case_reference: string
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          eligibility_status: Database["public"]["Enums"]["eligibility_status"]
          full_name: string
          general_location: string | null
          guardian_name: string | null
          id: string
          need_summary: string | null
          phone: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["review_status"]
        }
        ComputedFields: never
        Insert: {
          address_detail?: string | null
          case_reference?: string
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          eligibility_status?: Database["public"]["Enums"]["eligibility_status"]
          full_name: string
          general_location?: string | null
          guardian_name?: string | null
          id?: string
          need_summary?: string | null
          phone?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          address_detail?: string | null
          case_reference?: string
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          eligibility_status?: Database["public"]["Enums"]["eligibility_status"]
          full_name?: string
          general_location?: string | null
          guardian_name?: string | null
          id?: string
          need_summary?: string | null
          phone?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          name: string
          phone: string | null
          preferred_language: string
          status: Database["public"]["Enums"]["message_status"]
          subject: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          preferred_language?: string
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          preferred_language?: string
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Relationships: []
      }
      contributions: {
        Row: {
          amount: number
          contribution_date: string
          contribution_month: string
          created_at: string
          currency: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          profile_id: string
          receipt_path: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          transaction_reference: string | null
          verification_status: Database["public"]["Enums"]["contribution_status"]
          verified_at: string | null
          verified_by: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          contribution_date: string
          contribution_month: string
          created_at?: string
          currency?: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          profile_id: string
          receipt_path?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          transaction_reference?: string | null
          verification_status?: Database["public"]["Enums"]["contribution_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          contribution_date?: string
          contribution_month?: string
          created_at?: string
          currency?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          profile_id?: string
          receipt_path?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          transaction_reference?: string | null
          verification_status?: Database["public"]["Enums"]["contribution_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          access_level: Database["public"]["Enums"]["document_access"]
          created_at: string
          created_by: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_path: string
          id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          title_bn: string | null
          title_en: string | null
        }
        ComputedFields: never
        Insert: {
          access_level?: Database["public"]["Enums"]["document_access"]
          created_at?: string
          created_by?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_path: string
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          title_bn?: string | null
          title_en?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["document_access"]
          created_at?: string
          created_by?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_path?: string
          id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          title_bn?: string | null
          title_en?: string | null
        }
        Relationships: []
      }
      employment_projects: {
        Row: {
          actual_expense: number
          approved_budget: number | null
          beneficiary_id: string
          created_at: string
          estimated_budget: number | null
          follow_up_status: Database["public"]["Enums"]["follow_up_status"]
          id: string
          implementation_status: Database["public"]["Enums"]["project_status"]
          project_reference: string
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          actual_expense?: number
          approved_budget?: number | null
          beneficiary_id: string
          created_at?: string
          estimated_budget?: number | null
          follow_up_status?: Database["public"]["Enums"]["follow_up_status"]
          id?: string
          implementation_status?: Database["public"]["Enums"]["project_status"]
          project_reference?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_expense?: number
          approved_budget?: number | null
          beneficiary_id?: string
          created_at?: string
          estimated_budget?: number | null
          follow_up_status?: Database["public"]["Enums"]["follow_up_status"]
          id?: string
          implementation_status?: Database["public"]["Enums"]["project_status"]
          project_reference?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_projects_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_transactions: {
        Row: {
          amount: number
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          assistance_record_id: string | null
          contribution_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          fund_id: string
          id: string
          reverses_transaction_id: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["ledger_transaction_type"]
          transfer_reference: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          assistance_record_id?: string | null
          contribution_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: Database["public"]["Enums"]["ledger_direction"]
          fund_id: string
          id?: string
          reverses_transaction_id?: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["ledger_transaction_type"]
          transfer_reference?: string | null
        }
        Update: {
          amount?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          assistance_record_id?: string | null
          contribution_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["ledger_direction"]
          fund_id?: string
          id?: string
          reverses_transaction_id?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["ledger_transaction_type"]
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fund_transactions_assistance_fk"
            columns: ["assistance_record_id"]
            referencedRelation: "assistance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_contribution_id_fkey"
            columns: ["contribution_id"]
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_fund_id_fkey"
            columns: ["fund_id"]
            referencedRelation: "fund_balances"
            referencedColumns: ["fund_id"]
          },
          {
            foreignKeyName: "fund_transactions_fund_id_fkey"
            columns: ["fund_id"]
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_reverses_transaction_id_fkey"
            columns: ["reverses_transaction_id"]
            referencedRelation: "fund_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      funds: {
        Row: {
          active_status: boolean
          created_at: string
          default_allocation_percent: number
          description: string | null
          description_bn: string | null
          fund_type: Database["public"]["Enums"]["fund_type"]
          id: string
          name: string
          name_bn: string
        }
        ComputedFields: never
        Insert: {
          active_status?: boolean
          created_at?: string
          default_allocation_percent: number
          description?: string | null
          description_bn?: string | null
          fund_type: Database["public"]["Enums"]["fund_type"]
          id?: string
          name: string
          name_bn: string
        }
        Update: {
          active_status?: boolean
          created_at?: string
          default_allocation_percent?: number
          description?: string | null
          description_bn?: string | null
          fund_type?: Database["public"]["Enums"]["fund_type"]
          id?: string
          name?: string
          name_bn?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          caption_bn: string | null
          caption_en: string | null
          created_at: string
          created_by: string | null
          id: string
          image_date: string | null
          image_path: string
          privacy_level: Database["public"]["Enums"]["privacy_level"]
          publication_status: Database["public"]["Enums"]["publication_status"]
          related_activity_id: string | null
        }
        ComputedFields: never
        Insert: {
          caption_bn?: string | null
          caption_en?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_date?: string | null
          image_path: string
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          publication_status?: Database["public"]["Enums"]["publication_status"]
          related_activity_id?: string | null
        }
        Update: {
          caption_bn?: string | null
          caption_en?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_date?: string | null
          image_path?: string
          privacy_level?: Database["public"]["Enums"]["privacy_level"]
          publication_status?: Database["public"]["Enums"]["publication_status"]
          related_activity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_related_activity_id_fkey"
            columns: ["related_activity_id"]
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_applications: {
        Row: {
          address_line: string | null
          application_reference: string
          approved_profile_id: string | null
          consent_accepted: boolean
          consent_at: string
          date_of_birth: string | null
          decision_reason: string | null
          district: string | null
          email: string | null
          full_name: string
          id: string
          internal_notes: string | null
          motivation: string | null
          occupation: string | null
          phone: string
          preferred_language: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          upazila: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          address_line?: string | null
          application_reference?: string
          approved_profile_id?: string | null
          consent_accepted: boolean
          consent_at?: string
          date_of_birth?: string | null
          decision_reason?: string | null
          district?: string | null
          email?: string | null
          full_name: string
          id?: string
          internal_notes?: string | null
          motivation?: string | null
          occupation?: string | null
          phone: string
          preferred_language?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          upazila?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          application_reference?: string
          approved_profile_id?: string | null
          consent_accepted?: boolean
          consent_at?: string
          date_of_birth?: string | null
          decision_reason?: string | null
          district?: string | null
          email?: string | null
          full_name?: string
          id?: string
          internal_notes?: string | null
          motivation?: string | null
          occupation?: string | null
          phone?: string
          preferred_language?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          upazila?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_applications_approved_profile_id_fkey"
            columns: ["approved_profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_report_fund_lines: {
        Row: {
          closing_balance: number
          fund_id: string
          id: string
          opening_balance: number
          report_id: string
          total_in: number
          total_out: number
        }
        ComputedFields: never
        Insert: {
          closing_balance: number
          fund_id: string
          id?: string
          opening_balance: number
          report_id: string
          total_in: number
          total_out: number
        }
        Update: {
          closing_balance?: number
          fund_id?: string
          id?: string
          opening_balance?: number
          report_id?: string
          total_in?: number
          total_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_report_fund_lines_fund_id_fkey"
            columns: ["fund_id"]
            referencedRelation: "fund_balances"
            referencedColumns: ["fund_id"]
          },
          {
            foreignKeyName: "monthly_report_fund_lines_fund_id_fkey"
            columns: ["fund_id"]
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_report_fund_lines_report_id_fkey"
            columns: ["report_id"]
            referencedRelation: "monthly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          reporting_month: string
          summary_bn: string | null
          summary_en: string | null
          verification_status: Database["public"]["Enums"]["review_status"]
          verified_at: string | null
          verified_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          reporting_month: string
          summary_bn?: string | null
          summary_en?: string | null
          verification_status?: Database["public"]["Enums"]["review_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          reporting_month?: string
          summary_bn?: string | null
          summary_en?: string | null
          verification_status?: Database["public"]["Enums"]["review_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          general_location: string | null
          id: string
          member_id: string
          membership_start_date: string | null
          membership_status: Database["public"]["Enums"]["membership_status"]
          phone: string | null
          profile_image_path: string | null
          public_profile_approved: boolean
          public_profile_preference: boolean
          short_bio: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          general_location?: string | null
          id: string
          member_id?: string
          membership_start_date?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          phone?: string | null
          profile_image_path?: string | null
          public_profile_approved?: boolean
          public_profile_preference?: boolean
          short_bio?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          general_location?: string | null
          id?: string
          member_id?: string
          membership_start_date?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          phone?: string | null
          profile_image_path?: string | null
          public_profile_approved?: boolean
          public_profile_preference?: boolean
          short_bio?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      fund_balances: {
        Row: {
          balance: number | null
          fund_id: string | null
          fund_type: Database["public"]["Enums"]["fund_type"] | null
          name: string | null
          name_bn: string | null
        }
        ComputedFields: never
        Relationships: []
      }
    }
    Functions: {
      generate_member_id: { Args: Record<PropertyKey, never>; Returns: string }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_active_member: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_public_member_photo: { Args: { p_path: string }; Returns: boolean }
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean }
      list_public_member_profiles: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          full_name: string
          general_location: string
          id: string
          profile_image_path: string
          short_bio: string
        }[]
      }
      submit_contact_message: {
        Args: {
          p_email: string
          p_message: string
          p_name: string
          p_phone: string
          p_preferred_language: string
          p_subject: string
        }
        Returns: undefined
      }
      submit_membership_application: {
        Args: {
          p_address_line: string
          p_consent: boolean
          p_date_of_birth: string
          p_district: string
          p_email: string
          p_full_name: string
          p_motivation: string
          p_occupation: string
          p_phone: string
          p_preferred_language: string
          p_upazila: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "member" | "editor" | "treasurer" | "admin"
      application_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "withdrawn"
      approval_status: "pending" | "approved" | "rejected"
      assistance_status:
        | "proposed"
        | "approved"
        | "partially_disbursed"
        | "disbursed"
        | "rejected"
        | "cancelled"
      audience_type: "public" | "members" | "admins"
      consent_status: "pending" | "granted" | "withdrawn"
      contribution_status: "pending" | "verified" | "rejected" | "reversed"
      document_access: "public" | "members" | "admin"
      document_type: "constitution" | "policy" | "report" | "form" | "other"
      eligibility_status: "pending" | "eligible" | "ineligible"
      follow_up_status: "not_due" | "due" | "completed" | "overdue"
      fund_type: "direct_aid" | "employment" | "emergency_medical"
      ledger_direction: "credit" | "debit"
      ledger_transaction_type:
        | "allocation"
        | "disbursement"
        | "transfer_in"
        | "transfer_out"
        | "adjustment"
        | "reversal"
      membership_status: "pending" | "active" | "suspended" | "resigned"
      message_status: "new" | "read" | "archived"
      payment_method:
        | "cash"
        | "bkash"
        | "nagad"
        | "rocket"
        | "bank_transfer"
        | "other"
      privacy_level: "private" | "members" | "public_anonymized" | "public"
      project_status:
        | "planned"
        | "approved"
        | "in_progress"
        | "completed"
        | "cancelled"
      publication_status: "draft" | "published" | "archived"
      review_status: "pending" | "verified" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["member", "editor", "treasurer", "admin"],
      application_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "withdrawn",
      ],
      approval_status: ["pending", "approved", "rejected"],
      assistance_status: [
        "proposed",
        "approved",
        "partially_disbursed",
        "disbursed",
        "rejected",
        "cancelled",
      ],
      audience_type: ["public", "members", "admins"],
      consent_status: ["pending", "granted", "withdrawn"],
      contribution_status: ["pending", "verified", "rejected", "reversed"],
      document_access: ["public", "members", "admin"],
      document_type: ["constitution", "policy", "report", "form", "other"],
      eligibility_status: ["pending", "eligible", "ineligible"],
      follow_up_status: ["not_due", "due", "completed", "overdue"],
      fund_type: ["direct_aid", "employment", "emergency_medical"],
      ledger_direction: ["credit", "debit"],
      ledger_transaction_type: [
        "allocation",
        "disbursement",
        "transfer_in",
        "transfer_out",
        "adjustment",
        "reversal",
      ],
      membership_status: ["pending", "active", "suspended", "resigned"],
      message_status: ["new", "read", "archived"],
      payment_method: [
        "cash",
        "bkash",
        "nagad",
        "rocket",
        "bank_transfer",
        "other",
      ],
      privacy_level: ["private", "members", "public_anonymized", "public"],
      project_status: [
        "planned",
        "approved",
        "in_progress",
        "completed",
        "cancelled",
      ],
      publication_status: ["draft", "published", "archived"],
      review_status: ["pending", "verified", "rejected"],
    },
  },
} as const
