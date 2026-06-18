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
          gateway_fee_percent: number
          gst_percent: number
          id: boolean
          payout_hold_days: number
          rental_price_percent: number
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          delivery_fee?: number
          gateway_fee_percent?: number
          gst_percent?: number
          id?: boolean
          payout_hold_days?: number
          rental_price_percent?: number
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          delivery_fee?: number
          gateway_fee_percent?: number
          gst_percent?: number
          id?: boolean
          payout_hold_days?: number
          rental_price_percent?: number
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
          price_per_day: number
          purpose: Database["public"]["Enums"]["product_purpose"]
          quantity: number
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
          price_per_day: number
          purpose?: Database["public"]["Enums"]["product_purpose"]
          quantity?: number
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
          price_per_day?: number
          purpose?: Database["public"]["Enums"]["product_purpose"]
          quantity?: number
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
          avatar_url: string | null
          blocked: boolean
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          trust_score: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          trust_score?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blocked?: boolean
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          trust_score?: number
          updated_at?: string
        }
        Relationships: []
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
          commission_amount: number
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
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string
          quantity: number
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          refund_amount: number | null
          rental_total: number
          return_initiated_at: string | null
          returned_at: string | null
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
          commission_amount?: number
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
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id: string
          quantity?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refund_amount?: number | null
          rental_total?: number
          return_initiated_at?: string | null
          returned_at?: string | null
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
          commission_amount?: number
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
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id?: string
          quantity?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          refund_amount?: number | null
          rental_total?: number
          return_initiated_at?: string | null
          returned_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          store_id?: string
          subtotal?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
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
      stores: {
        Row: {
          address: string | null
          approved: boolean
          city: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_blocked: boolean
          is_verified: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          owner_id: string
          rating: number
          rating_count: number
          status: Database["public"]["Enums"]["store_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          owner_id: string
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["store_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_blocked?: boolean
          is_verified?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          rating?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["store_status"]
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
      admin_set_user_role: {
        Args: {
          _grant?: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
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
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_store_owner_of_rental: {
        Args: { _rental_id: string; _user_id: string }
        Returns: boolean
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
      app_role: "customer" | "store_owner" | "admin"
      campaign_audience: "all" | "selected" | "city" | "category"
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "failed"
      delivery_method: "delivery" | "pickup"
      dispute_status: "open" | "reviewing" | "resolved" | "rejected"
      extension_status: "pending" | "approved" | "rejected"
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
      product_category: "dress" | "jewellery"
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
      store_status: "pending" | "approved" | "rejected" | "deleted"
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
      app_role: ["customer", "store_owner", "admin"],
      campaign_audience: ["all", "selected", "city", "category"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "failed"],
      delivery_method: ["delivery", "pickup"],
      dispute_status: ["open", "reviewing", "resolved", "rejected"],
      extension_status: ["pending", "approved", "rejected"],
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
      product_category: ["dress", "jewellery"],
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
      store_status: ["pending", "approved", "rejected", "deleted"],
    },
  },
} as const
