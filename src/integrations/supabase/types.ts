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
      products: {
        Row: {
          available: boolean
          category: Database["public"]["Enums"]["product_category"]
          color: string | null
          condition_notes: string | null
          created_at: string
          description: string | null
          id: string
          images: string[]
          price_per_day: number
          security_deposit: number
          size: string | null
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          category: Database["public"]["Enums"]["product_category"]
          color?: string | null
          condition_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          price_per_day: number
          security_deposit: number
          size?: string | null
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          category?: Database["public"]["Enums"]["product_category"]
          color?: string | null
          condition_notes?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          price_per_day?: number
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
          created_at: string
          customer_id: string
          days: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          deposit: number
          end_date: string
          grand_total: number
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string
          refund_amount: number | null
          rental_total: number
          start_date: string
          status: Database["public"]["Enums"]["rental_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_id: string
          days: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          deposit: number
          end_date: string
          grand_total: number
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id: string
          refund_amount?: number | null
          rental_total: number
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_id?: string
          days?: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          deposit?: number
          end_date?: string
          grand_total?: number
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id?: string
          refund_amount?: number | null
          rental_total?: number
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          store_id?: string
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
    }
    Enums: {
      app_role: "customer" | "store_owner" | "admin"
      delivery_method: "delivery" | "pickup"
      dispute_status: "open" | "reviewing" | "resolved" | "rejected"
      image_stage: "before_delivery" | "at_delivery" | "after_return"
      payment_status: "unpaid" | "paid" | "refunded" | "partial_refund"
      product_category: "dress" | "jewellery"
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
      payment_status: ["unpaid", "paid", "refunded", "partial_refund"],
      product_category: ["dress", "jewellery"],
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
