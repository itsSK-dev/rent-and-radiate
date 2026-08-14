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
      ad_packages: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          name: string
          perks: string[]
          price: number
          sort_order: number
          tier: Database["public"]["Enums"]["ad_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          perks?: string[]
          price?: number
          sort_order?: number
          tier: Database["public"]["Enums"]["ad_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          perks?: string[]
          price?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["ad_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      ad_platform_stats: {
        Row: {
          engagement_pct: number
          id: boolean
          monthly_views: number
          partners_count: number
          reach_count: number
          updated_at: string
          users_count: number
        }
        Insert: {
          engagement_pct?: number
          id?: boolean
          monthly_views?: number
          partners_count?: number
          reach_count?: number
          updated_at?: string
          users_count?: number
        }
        Update: {
          engagement_pct?: number
          id?: boolean
          monthly_views?: number
          partners_count?: number
          reach_count?: number
          updated_at?: string
          users_count?: number
        }
        Relationships: []
      }
      ad_request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["ad_request_status"] | null
          id: string
          note: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["ad_request_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ad_request_status"] | null
          id?: string
          note?: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["ad_request_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["ad_request_status"] | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["ad_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ad_request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "advertisement_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          summary: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          summary?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          summary?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      advertisement_requests: {
        Row: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          admin_notes: string | null
          advertiser_id: string
          budget: number
          company_name: string
          contact_person: string
          created_at: string
          creative_url: string | null
          description: string | null
          duration_days: number
          email: string
          end_date: string | null
          id: string
          logo_url: string | null
          mobile: string
          package_id: string | null
          payment_status: Database["public"]["Enums"]["ad_payment_status"]
          set_price: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["ad_request_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          admin_notes?: string | null
          advertiser_id: string
          budget?: number
          company_name: string
          contact_person: string
          created_at?: string
          creative_url?: string | null
          description?: string | null
          duration_days?: number
          email: string
          end_date?: string | null
          id?: string
          logo_url?: string | null
          mobile: string
          package_id?: string | null
          payment_status?: Database["public"]["Enums"]["ad_payment_status"]
          set_price?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ad_request_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          ad_type?: Database["public"]["Enums"]["ad_type"]
          admin_notes?: string | null
          advertiser_id?: string
          budget?: number
          company_name?: string
          contact_person?: string
          created_at?: string
          creative_url?: string | null
          description?: string | null
          duration_days?: number
          email?: string
          end_date?: string | null
          id?: string
          logo_url?: string | null
          mobile?: string
          package_id?: string | null
          payment_status?: Database["public"]["Enums"]["ad_payment_status"]
          set_price?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["ad_request_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertisement_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ad_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisements: {
        Row: {
          created_at: string
          headline: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          request_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          headline: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          request_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          headline?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          request_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "advertisement_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          kind: Database["public"]["Enums"]["order_kind"]
          product_id: string
          quantity: number
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          product_id: string
          quantity?: number
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          product_id?: string
          quantity?: number
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      category_commissions: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          commission_percent: number
          created_at: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          commission_percent: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          commission_percent?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_assignments: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          partner_id: string
          picked_up_at: string | null
          rental_id: string
          return_picked_up_at: string | null
          returned_to_store_at: string | null
          status: Database["public"]["Enums"]["delivery_assignment_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          partner_id: string
          picked_up_at?: string | null
          rental_id: string
          return_picked_up_at?: string | null
          returned_to_store_at?: string | null
          status?: Database["public"]["Enums"]["delivery_assignment_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          partner_id?: string
          picked_up_at?: string | null
          rental_id?: string
          return_picked_up_at?: string | null
          returned_to_store_at?: string | null
          status?: Database["public"]["Enums"]["delivery_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_earnings: {
        Row: {
          amount: number
          assignment_id: string
          created_at: string
          id: string
          paid_at: string | null
          partner_id: string
          rental_id: string
          status: string
        }
        Insert: {
          amount?: number
          assignment_id: string
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id: string
          rental_id: string
          status?: string
        }
        Update: {
          amount?: number
          assignment_id?: string
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id?: string
          rental_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_earnings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_earnings_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_otps: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["delivery_otp_kind"]
          rental_id: string
          verified_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          kind: Database["public"]["Enums"]["delivery_otp_kind"]
          rental_id: string
          verified_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["delivery_otp_kind"]
          rental_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_otps_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_partner_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_path: string
          id: string
          partner_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_path: string
          id?: string
          partner_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_path?: string
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_partner_documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_partners: {
        Row: {
          additional_info: string | null
          approved_at: string | null
          approved_by: string | null
          bank_account: string | null
          city: string
          created_at: string
          current_address: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string
          emergency_contact_number: string
          experience_duration: string | null
          full_name: string
          gender: string | null
          has_experience: boolean | null
          id: string
          is_online: boolean
          mobile: string
          permanent_address: string | null
          pin_code: string
          previous_company: string | null
          profile_photo_url: string | null
          rejection_reason: string | null
          state: string
          status: Database["public"]["Enums"]["delivery_partner_status"]
          updated_at: string
          upi_id: string | null
          user_id: string
          vehicle_number: string | null
          vehicle_type: Database["public"]["Enums"]["delivery_vehicle_type"]
        }
        Insert: {
          additional_info?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          city: string
          created_at?: string
          current_address: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name: string
          emergency_contact_number: string
          experience_duration?: string | null
          full_name: string
          gender?: string | null
          has_experience?: boolean | null
          id?: string
          is_online?: boolean
          mobile: string
          permanent_address?: string | null
          pin_code: string
          previous_company?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          state: string
          status?: Database["public"]["Enums"]["delivery_partner_status"]
          updated_at?: string
          upi_id?: string | null
          user_id: string
          vehicle_number?: string | null
          vehicle_type: Database["public"]["Enums"]["delivery_vehicle_type"]
        }
        Update: {
          additional_info?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          city?: string
          created_at?: string
          current_address?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string
          emergency_contact_number?: string
          experience_duration?: string | null
          full_name?: string
          gender?: string | null
          has_experience?: boolean | null
          id?: string
          is_online?: boolean
          mobile?: string
          permanent_address?: string | null
          pin_code?: string
          previous_company?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          state?: string
          status?: Database["public"]["Enums"]["delivery_partner_status"]
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          vehicle_number?: string | null
          vehicle_type?: Database["public"]["Enums"]["delivery_vehicle_type"]
        }
        Relationships: []
      }
      delivery_proofs: {
        Row: {
          assignment_id: string
          created_at: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["delivery_proof_kind"]
          notes: string | null
          partner_id: string
          rental_id: string
          review_notes: string | null
          review_status: Database["public"]["Enums"]["delivery_proof_review"]
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          file_path: string
          id?: string
          kind: Database["public"]["Enums"]["delivery_proof_kind"]
          notes?: string | null
          partner_id: string
          rental_id: string
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["delivery_proof_review"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          file_path?: string
          id?: string
          kind?: Database["public"]["Enums"]["delivery_proof_kind"]
          notes?: string | null
          partner_id?: string
          rental_id?: string
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["delivery_proof_review"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "delivery_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proofs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_proofs_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_refunds: {
        Row: {
          admin_notes: string | null
          auto_created: boolean
          condition_tier: Database["public"]["Enums"]["refund_condition"]
          created_at: string
          customer_id: string
          damage_charges: number
          deposit_amount: number
          id: string
          initiated_at: string
          initiated_by: string
          inspection_images: string[]
          inspection_notes: string | null
          late_fee: number
          razorpay_refund_id: string | null
          refund_amount: number
          refund_failure_reason: string | null
          refund_percent: number
          refunded_at: string | null
          rental_charges: number
          rental_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          store_id: string
          total_deductions: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          auto_created?: boolean
          condition_tier: Database["public"]["Enums"]["refund_condition"]
          created_at?: string
          customer_id: string
          damage_charges?: number
          deposit_amount: number
          id?: string
          initiated_at?: string
          initiated_by: string
          inspection_images?: string[]
          inspection_notes?: string | null
          late_fee?: number
          razorpay_refund_id?: string | null
          refund_amount: number
          refund_failure_reason?: string | null
          refund_percent: number
          refunded_at?: string | null
          rental_charges?: number
          rental_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          store_id: string
          total_deductions?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          auto_created?: boolean
          condition_tier?: Database["public"]["Enums"]["refund_condition"]
          created_at?: string
          customer_id?: string
          damage_charges?: number
          deposit_amount?: number
          id?: string
          initiated_at?: string
          initiated_by?: string
          inspection_images?: string[]
          inspection_notes?: string | null
          late_fee?: number
          razorpay_refund_id?: string | null
          refund_amount?: number
          refund_failure_reason?: string | null
          refund_percent?: number
          refunded_at?: string | null
          rental_charges?: number
          rental_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          store_id?: string
          total_deductions?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: []
      }
      dispute_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          dispute_id: string
          from_status: Database["public"]["Enums"]["dispute_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          dispute_id: string
          from_status?: Database["public"]["Enums"]["dispute_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          dispute_id?: string
          from_status?: Database["public"]["Enums"]["dispute_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_notes: string | null
          assigned_admin: string | null
          created_at: string
          evidence_images: string[]
          id: string
          opened_by: string
          reason: string
          rental_id: string
          resolution: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_admin?: string | null
          created_at?: string
          evidence_images?: string[]
          id?: string
          opened_by: string
          reason: string
          rental_id: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_admin?: string | null
          created_at?: string
          evidence_images?: string[]
          id?: string
          opened_by?: string
          reason?: string
          rental_id?: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_opened_by_profiles_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          kind: Database["public"]["Enums"]["fraud_alert_kind"]
          metadata: Json
          rental_id: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: Database["public"]["Enums"]["fraud_alert_severity"]
          status: Database["public"]["Enums"]["fraud_alert_status"]
          subject_store_id: string | null
          subject_user_id: string | null
          title: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          kind: Database["public"]["Enums"]["fraud_alert_kind"]
          metadata?: Json
          rental_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["fraud_alert_severity"]
          status?: Database["public"]["Enums"]["fraud_alert_status"]
          subject_store_id?: string | null
          subject_user_id?: string | null
          title: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          kind?: Database["public"]["Enums"]["fraud_alert_kind"]
          metadata?: Json
          rental_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: Database["public"]["Enums"]["fraud_alert_severity"]
          status?: Database["public"]["Enums"]["fraud_alert_status"]
          subject_store_id?: string | null
          subject_user_id?: string | null
          title?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_alerts_subject_store_id_fkey"
            columns: ["subject_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      location_interest: {
        Row: {
          city: string
          created_at: string
          email: string | null
          id: string
          phone: string | null
          region: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          city: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          region?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          region?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      manual_payments: {
        Row: {
          admin_notes: string | null
          amount: number
          commission_amount: number
          created_at: string
          id: string
          payout_amount: number | null
          payout_notes: string | null
          payout_paid_at: string | null
          payout_status: Database["public"]["Enums"]["payout_status"]
          rental_id: string
          status: Database["public"]["Enums"]["manual_payment_status"]
          store_id: string
          updated_at: string
          upi_id: string
          user_id: string
          user_reference: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          commission_amount?: number
          created_at?: string
          id?: string
          payout_amount?: number | null
          payout_notes?: string | null
          payout_paid_at?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          rental_id: string
          status?: Database["public"]["Enums"]["manual_payment_status"]
          store_id: string
          updated_at?: string
          upi_id: string
          user_id: string
          user_reference?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          commission_amount?: number
          created_at?: string
          id?: string
          payout_amount?: number | null
          payout_notes?: string | null
          payout_paid_at?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          rental_id?: string
          status?: Database["public"]["Enums"]["manual_payment_status"]
          store_id?: string
          updated_at?: string
          upi_id?: string
          user_id?: string
          user_reference?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      notification_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          notification_id: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          notification_id?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          notification_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_campaign_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaigns: {
        Row: {
          audience_filter: Json
          audience_type: Database["public"]["Enums"]["campaign_audience"]
          body: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          image_url: string | null
          link_url: string | null
          recipient_count: number
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
        }
        Insert: {
          audience_filter?: Json
          audience_type?: Database["public"]["Enums"]["campaign_audience"]
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          recipient_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Update: {
          audience_filter?: Json
          audience_type?: Database["public"]["Enums"]["campaign_audience"]
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          recipient_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          discounts_offers: boolean
          new_products: boolean
          order_updates: boolean
          promotional: boolean
          rental_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discounts_offers?: boolean
          new_products?: boolean
          order_updates?: boolean
          promotional?: boolean
          rental_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discounts_offers?: boolean
          new_products?: boolean
          order_updates?: boolean
          promotional?: boolean
          rental_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string
          id: string
          image_url: string | null
          is_deleted: boolean
          is_read: boolean
          link_url: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          is_read?: boolean
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          id: boolean
          instructions: string
          payee_name: string
          qr_image_url: string | null
          updated_at: string
          upi_id: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          id?: boolean
          instructions?: string
          payee_name?: string
          qr_image_url?: string | null
          updated_at?: string
          upi_id?: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          id?: boolean
          instructions?: string
          payee_name?: string
          qr_image_url?: string | null
          updated_at?: string
          upi_id?: string
        }
        Relationships: []
      }
      payment_verification_attempts: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          ip: string | null
          outcome: string
          provider: string
          raw: Json | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          reason: string | null
          rental_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          ip?: string | null
          outcome: string
          provider: string
          raw?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reason?: string | null
          rental_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          ip?: string | null
          outcome?: string
          provider?: string
          raw?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reason?: string | null
          rental_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error_code: string | null
          error_description: string | null
          id: string
          method: string
          provider: string
          raw: Json | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          rental_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method: string
          provider?: string
          raw?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          rental_id: string
          status: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          method?: string
          provider?: string
          raw?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          rental_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          commission_percent: number
          delivery_fee: number
          delivery_fee_slabs: Json
          deposit_percent_of_price: number
          gateway_fee_percent: number
          gst_enabled: boolean
          gst_percent: number
          id: boolean
          late_fee_grace_hours: number
          late_fee_multiplier: number
          payout_hold_days: number
          platform_fee_slabs: Json
          protection_claim_rules: string | null
          protection_claim_window_days: number
          protection_max_claim_percent: number
          protection_min_photos: number
          protection_non_refundable_after_delivery: boolean
          protection_plan_enabled: boolean
          protection_plan_min: number
          protection_plan_percent: number
          protection_refund_on_cancel_percent: number
          protection_refund_rules: string | null
          protection_refund_window_days: number
          protection_requires_photos: boolean
          referral_min_order_amount: number
          referral_referrer_bonus: number
          referral_signup_bonus: number
          referrals_enabled: boolean
          reminder_intervals_hours: number[]
          rent_to_own_credit_percent: number
          rent_to_own_enabled: boolean
          rental_platform_fee_enabled: boolean
          rental_price_percent: number
          reward_earn_rate_percent: number
          reward_max_redeem_percent: number
          reward_points_per_rupee: number
          reward_redeem_value: number
          rewards_enabled: boolean
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          delivery_fee?: number
          delivery_fee_slabs?: Json
          deposit_percent_of_price?: number
          gateway_fee_percent?: number
          gst_enabled?: boolean
          gst_percent?: number
          id?: boolean
          late_fee_grace_hours?: number
          late_fee_multiplier?: number
          payout_hold_days?: number
          platform_fee_slabs?: Json
          protection_claim_rules?: string | null
          protection_claim_window_days?: number
          protection_max_claim_percent?: number
          protection_min_photos?: number
          protection_non_refundable_after_delivery?: boolean
          protection_plan_enabled?: boolean
          protection_plan_min?: number
          protection_plan_percent?: number
          protection_refund_on_cancel_percent?: number
          protection_refund_rules?: string | null
          protection_refund_window_days?: number
          protection_requires_photos?: boolean
          referral_min_order_amount?: number
          referral_referrer_bonus?: number
          referral_signup_bonus?: number
          referrals_enabled?: boolean
          reminder_intervals_hours?: number[]
          rent_to_own_credit_percent?: number
          rent_to_own_enabled?: boolean
          rental_platform_fee_enabled?: boolean
          rental_price_percent?: number
          reward_earn_rate_percent?: number
          reward_max_redeem_percent?: number
          reward_points_per_rupee?: number
          reward_redeem_value?: number
          rewards_enabled?: boolean
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          delivery_fee?: number
          delivery_fee_slabs?: Json
          deposit_percent_of_price?: number
          gateway_fee_percent?: number
          gst_enabled?: boolean
          gst_percent?: number
          id?: boolean
          late_fee_grace_hours?: number
          late_fee_multiplier?: number
          payout_hold_days?: number
          platform_fee_slabs?: Json
          protection_claim_rules?: string | null
          protection_claim_window_days?: number
          protection_max_claim_percent?: number
          protection_min_photos?: number
          protection_non_refundable_after_delivery?: boolean
          protection_plan_enabled?: boolean
          protection_plan_min?: number
          protection_plan_percent?: number
          protection_refund_on_cancel_percent?: number
          protection_refund_rules?: string | null
          protection_refund_window_days?: number
          protection_requires_photos?: boolean
          referral_min_order_amount?: number
          referral_referrer_bonus?: number
          referral_signup_bonus?: number
          referrals_enabled?: boolean
          reminder_intervals_hours?: number[]
          rent_to_own_credit_percent?: number
          rent_to_own_enabled?: boolean
          rental_platform_fee_enabled?: boolean
          rental_price_percent?: number
          reward_earn_rate_percent?: number
          reward_max_redeem_percent?: number
          reward_points_per_rupee?: number
          reward_redeem_value?: number
          rewards_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          gradient: string
          icon_name: string
          is_active: boolean
          label: string
          launched_at: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          gradient?: string
          icon_name?: string
          is_active?: boolean
          label: string
          launched_at?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          gradient?: string
          icon_name?: string
          is_active?: boolean
          label?: string
          launched_at?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          actual_price: number
          available: boolean
          category: Database["public"]["Enums"]["product_category"]
          color: string | null
          condition_notes: string | null
          created_at: string
          description: string | null
          discount_flat: number
          discount_percent: number
          id: string
          images: string[]
          low_stock_threshold: number
          price_per_day: number
          purpose: Database["public"]["Enums"]["product_purpose"]
          quantity: number
          rent_to_own_enabled: boolean
          security_deposit: number
          size: string | null
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_price?: number
          available?: boolean
          category: Database["public"]["Enums"]["product_category"]
          color?: string | null
          condition_notes?: string | null
          created_at?: string
          description?: string | null
          discount_flat?: number
          discount_percent?: number
          id?: string
          images?: string[]
          low_stock_threshold?: number
          price_per_day: number
          purpose?: Database["public"]["Enums"]["product_purpose"]
          quantity?: number
          rent_to_own_enabled?: boolean
          security_deposit: number
          size?: string | null
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_price?: number
          available?: boolean
          category?: Database["public"]["Enums"]["product_category"]
          color?: string | null
          condition_notes?: string | null
          created_at?: string
          description?: string | null
          discount_flat?: number
          discount_percent?: number
          id?: string
          images?: string[]
          low_stock_threshold?: number
          price_per_day?: number
          purpose?: Database["public"]["Enums"]["product_purpose"]
          quantity?: number
          rent_to_own_enabled?: boolean
          security_deposit?: number
          size?: string | null
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          addr_city: string | null
          addr_full_name: string | null
          addr_house: string | null
          addr_instructions: string | null
          addr_landmark: string | null
          addr_mobile: string | null
          addr_pin: string | null
          addr_state: string | null
          addr_street: string | null
          avatar_url: string | null
          blocked: boolean
          created_at: string
          flagged_at: string | null
          full_name: string | null
          id: string
          is_suspicious: boolean
          lifetime_reward_points: number
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          reward_points: number
          suspicious_reason: string | null
          trust_score: number
          updated_at: string
        }
        Insert: {
          addr_city?: string | null
          addr_full_name?: string | null
          addr_house?: string | null
          addr_instructions?: string | null
          addr_landmark?: string | null
          addr_mobile?: string | null
          addr_pin?: string | null
          addr_state?: string | null
          addr_street?: string | null
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          flagged_at?: string | null
          full_name?: string | null
          id: string
          is_suspicious?: boolean
          lifetime_reward_points?: number
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          reward_points?: number
          suspicious_reason?: string | null
          trust_score?: number
          updated_at?: string
        }
        Update: {
          addr_city?: string | null
          addr_full_name?: string | null
          addr_house?: string | null
          addr_instructions?: string | null
          addr_landmark?: string | null
          addr_mobile?: string | null
          addr_pin?: string | null
          addr_state?: string | null
          addr_street?: string | null
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          flagged_at?: string | null
          full_name?: string | null
          id?: string
          is_suspicious?: boolean
          lifetime_reward_points?: number
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          reward_points?: number
          suspicious_reason?: string | null
          trust_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ratee_store_id: string | null
          ratee_user_id: string | null
          rater_id: string
          rental_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_store_id?: string | null
          ratee_user_id?: string | null
          rater_id: string
          rental_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_store_id?: string | null
          ratee_user_id?: string | null
          rater_id?: string
          rental_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ratee_store_id_fkey"
            columns: ["ratee_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          qualified_at: string | null
          qualifying_rental_id: string | null
          referral_code: string
          referred_user_id: string
          referrer_bonus_points: number
          referrer_id: string
          rewarded_at: string | null
          signup_bonus_points: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          qualifying_rental_id?: string | null
          referral_code: string
          referred_user_id: string
          referrer_bonus_points?: number
          referrer_id: string
          rewarded_at?: string | null
          signup_bonus_points?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          qualifying_rental_id?: string | null
          referral_code?: string
          referred_user_id?: string
          referrer_bonus_points?: number
          referrer_id?: string
          rewarded_at?: string | null
          signup_bonus_points?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_qualifying_rental_id_fkey"
            columns: ["qualifying_rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_extension_requests: {
        Row: {
          additional_days: number
          created_at: string
          current_end_date: string | null
          customer_id: string
          id: string
          reason: string | null
          rental_id: string
          requested_end_date: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["extension_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          additional_days: number
          created_at?: string
          current_end_date?: string | null
          customer_id: string
          id?: string
          reason?: string | null
          rental_id: string
          requested_end_date: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["extension_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          additional_days?: number
          created_at?: string
          current_end_date?: string | null
          customer_id?: string
          id?: string
          reason?: string | null
          rental_id?: string
          requested_end_date?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["extension_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rental_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          rental_id: string
          stage: Database["public"]["Enums"]["image_stage"]
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          rental_id: string
          stage: Database["public"]["Enums"]["image_stage"]
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          rental_id?: string
          stage?: Database["public"]["Enums"]["image_stage"]
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_images_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_reminders: {
        Row: {
          created_at: string
          due_at: string
          hours_before: number
          id: string
          rental_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          due_at: string
          hours_before: number
          id?: string
          rental_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          due_at?: string
          hours_before?: number
          id?: string
          rental_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_reminders_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["rental_status"] | null
          id: string
          note: string | null
          rental_id: string
          to_status: Database["public"]["Enums"]["rental_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["rental_status"] | null
          id?: string
          note?: string | null
          rental_id: string
          to_status: Database["public"]["Enums"]["rental_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["rental_status"] | null
          id?: string
          note?: string | null
          rental_id?: string
          to_status?: Database["public"]["Enums"]["rental_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rental_status_history_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          actual_delivered_at: string | null
          address: string | null
          assigned_partner_id: string | null
          commission_amount: number
          converted_to_purchase_rental_id: string | null
          created_at: string
          customer_id: string
          days: number | null
          delivery_fee: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_partner: string | null
          delivery_stage: string | null
          deposit: number
          discount_amount: number
          end_date: string | null
          expected_delivery_date: string | null
          grand_total: number
          gst_amount: number
          id: string
          kind: Database["public"]["Enums"]["order_kind"]
          late_fee_applied: number
          late_fee_hours: number
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_fee: number
          product_id: string
          protection_plan: boolean
          protection_plan_fee: number
          qr_token: string
          quantity: number
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          refund_amount: number | null
          rent_to_own_credit: number
          rental_total: number
          return_initiated_at: string | null
          returned_at: string | null
          reward_discount: number
          reward_points_earned: number
          reward_points_used: number
          ship_city: string | null
          ship_full_name: string | null
          ship_house: string | null
          ship_instructions: string | null
          ship_landmark: string | null
          ship_mobile: string | null
          ship_pin: string | null
          ship_state: string | null
          ship_street: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["rental_status"]
          store_id: string
          subtotal: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_delivered_at?: string | null
          address?: string | null
          assigned_partner_id?: string | null
          commission_amount?: number
          converted_to_purchase_rental_id?: string | null
          created_at?: string
          customer_id: string
          days?: number | null
          delivery_fee?: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_partner?: string | null
          delivery_stage?: string | null
          deposit?: number
          discount_amount?: number
          end_date?: string | null
          expected_delivery_date?: string | null
          grand_total: number
          gst_amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          late_fee_applied?: number
          late_fee_hours?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number
          product_id: string
          protection_plan?: boolean
          protection_plan_fee?: number
          qr_token?: string
          quantity?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refund_amount?: number | null
          rent_to_own_credit?: number
          rental_total?: number
          return_initiated_at?: string | null
          returned_at?: string | null
          reward_discount?: number
          reward_points_earned?: number
          reward_points_used?: number
          ship_city?: string | null
          ship_full_name?: string | null
          ship_house?: string | null
          ship_instructions?: string | null
          ship_landmark?: string | null
          ship_mobile?: string | null
          ship_pin?: string | null
          ship_state?: string | null
          ship_street?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          store_id: string
          subtotal?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_delivered_at?: string | null
          address?: string | null
          assigned_partner_id?: string | null
          commission_amount?: number
          converted_to_purchase_rental_id?: string | null
          created_at?: string
          customer_id?: string
          days?: number | null
          delivery_fee?: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_partner?: string | null
          delivery_stage?: string | null
          deposit?: number
          discount_amount?: number
          end_date?: string | null
          expected_delivery_date?: string | null
          grand_total?: number
          gst_amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          late_fee_applied?: number
          late_fee_hours?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number
          product_id?: string
          protection_plan?: boolean
          protection_plan_fee?: number
          qr_token?: string
          quantity?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refund_amount?: number | null
          rent_to_own_credit?: number
          rental_total?: number
          return_initiated_at?: string | null
          returned_at?: string | null
          reward_discount?: number
          reward_points_earned?: number
          reward_points_used?: number
          ship_city?: string | null
          ship_full_name?: string | null
          ship_house?: string | null
          ship_instructions?: string | null
          ship_landmark?: string | null
          ship_mobile?: string | null
          ship_pin?: string | null
          ship_state?: string | null
          ship_street?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          store_id?: string
          subtotal?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_assigned_partner_id_fkey"
            columns: ["assigned_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_converted_to_purchase_rental_id_fkey"
            columns: ["converted_to_purchase_rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_notes: string | null
          id: string
          photos: string[]
          picked_up_at: string | null
          pickup_address: string | null
          pickup_scheduled_at: string | null
          reason: string | null
          refund_processed_at: string | null
          rental_id: string
          returned_at: string | null
          status: Database["public"]["Enums"]["return_status"]
          store_id: string
          store_notes: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          customer_notes?: string | null
          id?: string
          photos?: string[]
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_scheduled_at?: string | null
          reason?: string | null
          refund_processed_at?: string | null
          rental_id: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          store_id: string
          store_notes?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_notes?: string | null
          id?: string
          photos?: string[]
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_scheduled_at?: string | null
          reason?: string | null
          refund_processed_at?: string | null
          rental_id?: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          store_id?: string
          store_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      return_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["return_status"] | null
          id: string
          note: string | null
          return_request_id: string
          to_status: Database["public"]["Enums"]["return_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["return_status"] | null
          id?: string
          note?: string | null
          return_request_id: string
          to_status: Database["public"]["Enums"]["return_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["return_status"] | null
          id?: string
          note?: string | null
          return_request_id?: string
          to_status?: Database["public"]["Enums"]["return_status"]
        }
        Relationships: []
      }
      reward_transactions: {
        Row: {
          balance_after: number
          created_at: string
          id: string
          kind: string
          metadata: Json
          note: string | null
          points: number
          referred_user_id: string | null
          rental_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          note?: string | null
          points: number
          referred_user_id?: string | null
          rental_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          note?: string | null
          points?: number
          referred_user_id?: string | null
          rental_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          ip: string | null
          metadata: Json
          notification_status: string | null
          notified_at: string | null
          severity: string
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          metadata?: Json
          notification_status?: string | null
          notified_at?: string | null
          severity: string
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          metadata?: Json
          notification_status?: string | null
          notified_at?: string | null
          severity?: string
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      shop_subscriptions: {
        Row: {
          assigned_by: string | null
          created_at: string
          end_at: string
          id: string
          notes: string | null
          plan_id: string
          price_paid: number
          start_at: string
          status: Database["public"]["Enums"]["shop_subscription_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          end_at: string
          id?: string
          notes?: string | null
          plan_id: string
          price_paid?: number
          start_at?: string
          status?: Database["public"]["Enums"]["shop_subscription_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          end_at?: string
          id?: string
          notes?: string | null
          plan_id?: string
          price_paid?: number
          start_at?: string
          status?: Database["public"]["Enums"]["shop_subscription_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_verifications: {
        Row: {
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          business_license_number: string | null
          business_license_url: string | null
          created_at: string
          gst_certificate_url: string | null
          gst_number: string | null
          id: string
          id_document_url: string | null
          id_number: string | null
          id_type: Database["public"]["Enums"]["store_id_doc_type"] | null
          owner_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shop_photos: string[]
          status: Database["public"]["Enums"]["store_verification_status"]
          store_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          business_license_number?: string | null
          business_license_url?: string | null
          created_at?: string
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          id_document_url?: string | null
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["store_id_doc_type"] | null
          owner_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_photos?: string[]
          status?: Database["public"]["Enums"]["store_verification_status"]
          store_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          business_license_number?: string | null
          business_license_url?: string | null
          created_at?: string
          gst_certificate_url?: string | null
          gst_number?: string | null
          id?: string
          id_document_url?: string | null
          id_number?: string | null
          id_type?: Database["public"]["Enums"]["store_id_doc_type"] | null
          owner_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_photos?: string[]
          status?: Database["public"]["Enums"]["store_verification_status"]
          store_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_verifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          approved: boolean
          city: string | null
          created_at: string
          description: string | null
          flagged_at: string | null
          id: string
          is_active: boolean
          is_blocked: boolean
          is_suspicious: boolean
          is_verified: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          owner_id: string
          rating: number
          rating_count: number
          rejection_reason: string | null
          status: Database["public"]["Enums"]["store_status"]
          suspicious_reason: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          flagged_at?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          is_suspicious?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          owner_id: string
          rating?: number
          rating_count?: number
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          suspicious_reason?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          flagged_at?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          is_suspicious?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          rating?: number
          rating_count?: number
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          suspicious_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          max_products: number | null
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days: number
          features?: Json
          id?: string
          is_active?: boolean
          max_products?: number | null
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_products?: number | null
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_contact: {
        Row: {
          email: string | null
          hours: string | null
          id: boolean
          link_label: string | null
          link_url: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          email?: string | null
          hours?: string | null
          id?: boolean
          link_label?: string | null
          link_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          email?: string | null
          hours?: string | null
          id?: boolean
          link_label?: string | null
          link_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      test_email_log: {
        Row: {
          created_at: string
          id: string
          infra_ready: boolean
          message: string | null
          recipient_email: string
          recipient_name: string | null
          recipient_role: string
          status: string
          template: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          infra_ready?: boolean
          message?: string | null
          recipient_email: string
          recipient_name?: string | null
          recipient_role: string
          status: string
          template: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          infra_ready?: boolean
          message?: string | null
          recipient_email?: string
          recipient_name?: string | null
          recipient_role?: string
          status?: string
          template?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      user_moderation_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_value: Json | null
          id: string
          reason: string | null
          target_user_id: string
          to_value: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_value?: Json | null
          id?: string
          reason?: string | null
          target_user_id: string
          to_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_value?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string
          to_value?: Json | null
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
      vendor_settlements: {
        Row: {
          created_at: string
          customer_id: string
          delivery_fee: number
          eligible_at: string | null
          gateway_fee: number
          gst_amount: number
          id: string
          kind: Database["public"]["Enums"]["order_kind"]
          net_payout: number
          notes: string | null
          other_deductions: number
          paid_at: string | null
          paid_by: string | null
          platform_fee: number
          platform_fee_percent: number
          rental_id: string
          sale_price: number
          status: Database["public"]["Enums"]["settlement_status"]
          store_id: string
          total_deductions: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_fee?: number
          eligible_at?: string | null
          gateway_fee?: number
          gst_amount?: number
          id?: string
          kind: Database["public"]["Enums"]["order_kind"]
          net_payout?: number
          notes?: string | null
          other_deductions?: number
          paid_at?: string | null
          paid_by?: string | null
          platform_fee?: number
          platform_fee_percent?: number
          rental_id: string
          sale_price?: number
          status?: Database["public"]["Enums"]["settlement_status"]
          store_id: string
          total_deductions?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_fee?: number
          eligible_at?: string | null
          gateway_fee?: number
          gst_amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          net_payout?: number
          notes?: string | null
          other_deductions?: number
          paid_at?: string | null
          paid_by?: string | null
          platform_fee?: number
          platform_fee_percent?: number
          rental_id?: string
          sale_price?: number
          status?: Database["public"]["Enums"]["settlement_status"]
          store_id?: string
          total_deductions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_settlements_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: true
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_settlements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _is_service_role: { Args: never; Returns: boolean }
      admin_flag_subject: {
        Args: { _flag: boolean; _id: string; _kind: string; _reason?: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _grant?: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      assign_delivery_partner: {
        Args: { _partner_id: string; _rental_id: string }
        Returns: string
      }
      can_view_customer_profile: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      create_notification: {
        Args: {
          _body?: string
          _image_url?: string
          _link_url?: string
          _metadata?: Json
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_referral_code: { Args: never; Returns: string }
      get_active_categories: {
        Args: never
        Returns: {
          created_at: string
          description: string | null
          gradient: string
          icon_name: string
          is_active: boolean
          label: string
          launched_at: string | null
          slug: string
          sort_order: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "product_categories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_effective_commission: {
        Args: { _product_id: string }
        Returns: number
      }
      get_public_payment_settings: {
        Args: never
        Returns: {
          instructions: string
          payee_name: string
          qr_image_url: string
          upi_id: string
        }[]
      }
      get_public_platform_settings: { Args: never; Returns: Json }
      get_rental_qr_token: { Args: { _rental_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner_of_store: { Args: { _store_id: string }; Returns: boolean }
      is_store_owner_of_rental: {
        Args: { _rental_id: string; _user_id: string }
        Returns: boolean
      }
      list_available_delivery_partners: {
        Args: never
        Returns: {
          active_assignments: number
          city: string
          full_name: string
          id: string
          is_online: boolean
          mobile: string
          status: Database["public"]["Enums"]["delivery_partner_status"]
          vehicle_type: Database["public"]["Enums"]["delivery_vehicle_type"]
        }[]
      }
      log_admin_event: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _summary?: string
          _target_user_id?: string
        }
        Returns: string
      }
      log_proof_access: {
        Args: { _context?: string; _path: string }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          _actor_email?: string
          _actor_user_id?: string
          _event_type: string
          _ip?: string
          _metadata?: Json
          _severity: string
          _summary?: string
          _user_agent?: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      promote_eligible_settlements: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      store_visible_or_owned: { Args: { _store_id: string }; Returns: boolean }
    }
    Enums: {
      ad_payment_status: "unpaid" | "paid" | "refunded"
      ad_request_status:
        | "draft"
        | "pending"
        | "changes_requested"
        | "approved"
        | "rejected"
        | "active"
        | "completed"
      ad_tier: "basic" | "premium" | "featured"
      ad_type:
        | "banner"
        | "featured_listing"
        | "sponsored_product"
        | "homepage_promotion"
        | "custom"
      app_role: "customer" | "store_owner" | "admin" | "delivery_partner"
      campaign_audience: "all" | "selected" | "city" | "category"
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "failed"
      delivery_assignment_status:
        | "broadcast"
        | "accepted"
        | "rejected"
        | "picked_up"
        | "out_for_delivery"
        | "delivered"
        | "return_scheduled"
        | "return_picked_up"
        | "returned_to_store"
        | "cancelled"
      delivery_method: "delivery" | "pickup"
      delivery_otp_kind: "delivery" | "return"
      delivery_partner_status: "pending" | "approved" | "rejected" | "suspended"
      delivery_proof_kind: "delivery" | "return"
      delivery_proof_review: "pending" | "approved" | "rejected"
      delivery_vehicle_type: "bike" | "cycle" | "scooter" | "car"
      dispute_status: "open" | "reviewing" | "resolved" | "rejected"
      extension_status: "pending" | "approved" | "rejected"
      fraud_alert_kind:
        | "suspicious_login"
        | "suspicious_payment"
        | "repeated_failed_payment"
        | "flagged_user"
        | "flagged_seller"
        | "chargeback"
        | "other"
      fraud_alert_severity: "low" | "medium" | "high" | "critical"
      fraud_alert_status: "open" | "reviewing" | "resolved" | "dismissed"
      image_stage: "before_delivery" | "at_delivery" | "after_return"
      manual_payment_status: "pending_verification" | "verified" | "failed"
      notification_type:
        | "new_product"
        | "discount"
        | "back_in_stock"
        | "order_update"
        | "rental_update"
        | "promo"
        | "admin_broadcast"
        | "delivery_update"
      order_kind: "rent" | "buy"
      payment_status:
        | "unpaid"
        | "paid"
        | "refunded"
        | "partial_refund"
        | "cod"
        | "pending_verification"
        | "verification_failed"
      payout_status: "unpaid" | "paid"
      product_category:
        | "dress"
        | "jewellery"
        | "accessory"
        | "footwear"
        | "bag"
        | "watch"
        | "beauty"
        | "electronics"
        | "camera"
        | "musical_instrument"
        | "furniture"
        | "home_decor"
        | "sports"
        | "baby"
        | "toys"
        | "books"
        | "other"
      product_purpose: "rent" | "buy" | "both"
      refund_condition: "perfect" | "minor" | "moderate" | "severe"
      refund_status:
        | "pending_admin"
        | "approved"
        | "rejected"
        | "processing"
        | "completed"
        | "failed"
      rental_status:
        | "pending"
        | "confirmed"
        | "delivered"
        | "returned"
        | "cancelled"
        | "accepted"
        | "rejected"
        | "packing"
        | "ready_for_pickup"
        | "shipped"
        | "assigned"
        | "picked_up"
        | "out_for_delivery"
        | "return_scheduled"
        | "return_picked_up"
        | "completed"
      return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "pickup_scheduled"
        | "picked_up"
        | "returned_to_store"
        | "refund_processed"
        | "completed"
      settlement_status:
        | "pending"
        | "eligible"
        | "paid"
        | "on_hold"
        | "reversed"
      shop_subscription_status: "active" | "expired" | "cancelled"
      store_id_doc_type: "aadhaar" | "pan"
      store_status: "pending" | "approved" | "rejected" | "deleted"
      store_verification_status: "draft" | "submitted" | "approved" | "rejected"
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
      ad_payment_status: ["unpaid", "paid", "refunded"],
      ad_request_status: [
        "draft",
        "pending",
        "changes_requested",
        "approved",
        "rejected",
        "active",
        "completed",
      ],
      ad_tier: ["basic", "premium", "featured"],
      ad_type: [
        "banner",
        "featured_listing",
        "sponsored_product",
        "homepage_promotion",
        "custom",
      ],
      app_role: ["customer", "store_owner", "admin", "delivery_partner"],
      campaign_audience: ["all", "selected", "city", "category"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "failed"],
      delivery_assignment_status: [
        "broadcast",
        "accepted",
        "rejected",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "return_scheduled",
        "return_picked_up",
        "returned_to_store",
        "cancelled",
      ],
      delivery_method: ["delivery", "pickup"],
      delivery_otp_kind: ["delivery", "return"],
      delivery_partner_status: ["pending", "approved", "rejected", "suspended"],
      delivery_proof_kind: ["delivery", "return"],
      delivery_proof_review: ["pending", "approved", "rejected"],
      delivery_vehicle_type: ["bike", "cycle", "scooter", "car"],
      dispute_status: ["open", "reviewing", "resolved", "rejected"],
      extension_status: ["pending", "approved", "rejected"],
      fraud_alert_kind: [
        "suspicious_login",
        "suspicious_payment",
        "repeated_failed_payment",
        "flagged_user",
        "flagged_seller",
        "chargeback",
        "other",
      ],
      fraud_alert_severity: ["low", "medium", "high", "critical"],
      fraud_alert_status: ["open", "reviewing", "resolved", "dismissed"],
      image_stage: ["before_delivery", "at_delivery", "after_return"],
      manual_payment_status: ["pending_verification", "verified", "failed"],
      notification_type: [
        "new_product",
        "discount",
        "back_in_stock",
        "order_update",
        "rental_update",
        "promo",
        "admin_broadcast",
        "delivery_update",
      ],
      order_kind: ["rent", "buy"],
      payment_status: [
        "unpaid",
        "paid",
        "refunded",
        "partial_refund",
        "cod",
        "pending_verification",
        "verification_failed",
      ],
      payout_status: ["unpaid", "paid"],
      product_category: [
        "dress",
        "jewellery",
        "accessory",
        "footwear",
        "bag",
        "watch",
        "beauty",
        "electronics",
        "camera",
        "musical_instrument",
        "furniture",
        "home_decor",
        "sports",
        "baby",
        "toys",
        "books",
        "other",
      ],
      product_purpose: ["rent", "buy", "both"],
      refund_condition: ["perfect", "minor", "moderate", "severe"],
      refund_status: [
        "pending_admin",
        "approved",
        "rejected",
        "processing",
        "completed",
        "failed",
      ],
      rental_status: [
        "pending",
        "confirmed",
        "delivered",
        "returned",
        "cancelled",
        "accepted",
        "rejected",
        "packing",
        "ready_for_pickup",
        "shipped",
        "assigned",
        "picked_up",
        "out_for_delivery",
        "return_scheduled",
        "return_picked_up",
        "completed",
      ],
      return_status: [
        "requested",
        "approved",
        "rejected",
        "pickup_scheduled",
        "picked_up",
        "returned_to_store",
        "refund_processed",
        "completed",
      ],
      settlement_status: ["pending", "eligible", "paid", "on_hold", "reversed"],
      shop_subscription_status: ["active", "expired", "cancelled"],
      store_id_doc_type: ["aadhaar", "pan"],
      store_status: ["pending", "approved", "rejected", "deleted"],
      store_verification_status: ["draft", "submitted", "approved", "rejected"],
    },
  },
} as const
