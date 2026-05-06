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
          condition_tier: Database["public"]["Enums"]["refund_condition"]
          created_at: string
          customer_id: string
          deposit_amount: number
          id: string
          initiated_at: string
          initiated_by: string
          inspection_images: string[]
          inspection_notes: string | null
          refund_amount: number
          refund_percent: number
          rental_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          condition_tier: Database["public"]["Enums"]["refund_condition"]
          created_at?: string
          customer_id: string
          deposit_amount: number
          id?: string
          initiated_at?: string
          initiated_by: string
          inspection_images?: string[]
          inspection_notes?: string | null
          refund_amount: number
          refund_percent: number
          rental_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          condition_tier?: Database["public"]["Enums"]["refund_condition"]
          created_at?: string
          customer_id?: string
          deposit_amount?: number
          id?: string
          initiated_at?: string
          initiated_by?: string
          inspection_images?: string[]
          inspection_notes?: string | null
          refund_amount?: number
          refund_percent?: number
          rental_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          store_id?: string
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
          gst_percent: number
          id: boolean
          updated_at: string
        }
        Insert: {
          commission_percent?: number
          delivery_fee?: number
          gst_percent?: number
          id?: boolean
          updated_at?: string
        }
        Update: {
          commission_percent?: number
          delivery_fee?: number
          gst_percent?: number
          id?: boolean
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
          address: string | null
          commission_amount: number
          created_at: string
          customer_id: string
          days: number | null
          delivery_fee: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          deposit: number
          discount_amount: number
          end_date: string | null
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
          start_date: string | null
          status: Database["public"]["Enums"]["rental_status"]
          store_id: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          commission_amount?: number
          created_at?: string
          customer_id: string
          days?: number | null
          delivery_fee?: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          deposit?: number
          discount_amount?: number
          end_date?: string | null
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
          start_date?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          store_id: string
          subtotal?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          commission_amount?: number
          created_at?: string
          customer_id?: string
          days?: number | null
          delivery_fee?: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          deposit?: number
          discount_amount?: number
          end_date?: string | null
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
          start_date?: string | null
          status?: Database["public"]["Enums"]["rental_status"]
          store_id?: string
          subtotal?: number
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
      stores: {
        Row: {
          address: string | null
          approved: boolean
          city: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          owner_id: string
          rating: number
          rating_count: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          owner_id: string
          rating?: number
          rating_count?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          rating?: number
          rating_count?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      request_store_owner_role: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "customer" | "store_owner" | "admin"
      delivery_method: "delivery" | "pickup"
      dispute_status: "open" | "reviewing" | "resolved" | "rejected"
      image_stage: "before_delivery" | "at_delivery" | "after_return"
      order_kind: "rent" | "buy"
      payment_status: "unpaid" | "paid" | "refunded" | "partial_refund" | "cod"
      product_category: "dress" | "jewellery"
      product_purpose: "rent" | "buy" | "both"
      refund_condition: "perfect" | "minor" | "moderate" | "severe"
      refund_status: "pending_admin" | "approved" | "rejected"
      rental_status:
        | "pending"
        | "confirmed"
        | "delivered"
        | "returned"
        | "cancelled"
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
      app_role: ["customer", "store_owner", "admin"],
      delivery_method: ["delivery", "pickup"],
      dispute_status: ["open", "reviewing", "resolved", "rejected"],
      image_stage: ["before_delivery", "at_delivery", "after_return"],
      order_kind: ["rent", "buy"],
      payment_status: ["unpaid", "paid", "refunded", "partial_refund", "cod"],
      product_category: ["dress", "jewellery"],
      product_purpose: ["rent", "buy", "both"],
      refund_condition: ["perfect", "minor", "moderate", "severe"],
      refund_status: ["pending_admin", "approved", "rejected"],
      rental_status: [
        "pending",
        "confirmed",
        "delivered",
        "returned",
        "cancelled",
      ],
    },
  },
} as const
