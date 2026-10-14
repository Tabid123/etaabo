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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          merchant_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          branch_id: string | null
          created_at: string
          device_type: string
          id: string
          label: string
          merchant_id: string
          public_token: string
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          device_type?: string
          id?: string
          label: string
          merchant_id: string
          public_token?: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          device_type?: string
          id?: string
          label?: string
          merchant_id?: string
          public_token?: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          branch_id: string | null
          category_id: string | null
          counterparty: string | null
          counterparty_name: string | null
          created_at: string
          currency: string
          dedupe_key: string | null
          direction: string
          id: string
          merchant_id: string
          message_excerpt: string | null
          occurred_at: string
          provider: string
          review_state: string
          sms_body: string | null
          sms_reader_id: string | null
          source: string
          tx_id: string | null
          updated_at: string
          verification_state: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category_id?: string | null
          counterparty?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          dedupe_key?: string | null
          direction: string
          id?: string
          merchant_id: string
          message_excerpt?: string | null
          occurred_at?: string
          provider: string
          review_state?: string
          sms_body?: string | null
          sms_reader_id?: string | null
          source?: string
          tx_id?: string | null
          updated_at?: string
          verification_state?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category_id?: string | null
          counterparty?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          dedupe_key?: string | null
          direction?: string
          id?: string
          merchant_id?: string
          message_excerpt?: string | null
          occurred_at?: string
          provider?: string
          review_state?: string
          sms_body?: string | null
          sms_reader_id?: string | null
          source?: string
          tx_id?: string | null
          updated_at?: string
          verification_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_sms_reader_id_fkey"
            columns: ["sms_reader_id"]
            isOneToOne: false
            referencedRelation: "sms_readers"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          merchant_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_feedback_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_memberships: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          merchant_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_memberships_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          logo_url: string | null
          merchant_id: string
          phone_number: string
          provider: string
          sort_order: number
          updated_at: string
          ussd_template: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          logo_url?: string | null
          merchant_id: string
          phone_number: string
          provider: string
          sort_order?: number
          updated_at?: string
          ussd_template?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          logo_url?: string | null
          merchant_id?: string
          phone_number?: string
          provider?: string
          sort_order?: number
          updated_at?: string
          ussd_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_methods_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          banner_url: string | null
          created_at: string
          currency: string
          edahab_logo_url: string | null
          evc_logo_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          merchant_id: string
          name: string
          phone_number: string
          premier_logo_url: string | null
          updated_at: string
          ussd_base_code: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          currency?: string
          edahab_logo_url?: string | null
          evc_logo_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          merchant_id: string
          name: string
          phone_number: string
          premier_logo_url?: string | null
          updated_at?: string
          ussd_base_code?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          currency?: string
          edahab_logo_url?: string | null
          evc_logo_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          merchant_id?: string
          name?: string
          phone_number?: string
          premier_logo_url?: string | null
          updated_at?: string
          ussd_base_code?: string
        }
        Relationships: []
      }
      payment_sessions: {
        Row: {
          amount: number
          branch_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          device_id: string | null
          id: string
          initiated_at: string
          merchant_id: string
          payment_method_id: string | null
          provider: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          device_id?: string | null
          id?: string
          initiated_at?: string
          merchant_id: string
          payment_method_id?: string | null
          provider: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          device_id?: string | null
          id?: string
          initiated_at?: string
          merchant_id?: string
          payment_method_id?: string | null
          provider?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "merchant_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_readers: {
        Row: {
          android_version: string | null
          app_version: string | null
          branch_id: string | null
          created_at: string
          device_manufacturer: string | null
          device_model: string | null
          id: string
          label: string
          last_seen_at: string | null
          last_sync_at: string | null
          merchant_id: string
          paired_at: string | null
          revoked_at: string | null
          sim_last4: string | null
          status: string
          updated_at: string
        }
        Insert: {
          android_version?: string | null
          app_version?: string | null
          branch_id?: string | null
          created_at?: string
          device_manufacturer?: string | null
          device_model?: string | null
          id?: string
          label: string
          last_seen_at?: string | null
          last_sync_at?: string | null
          merchant_id: string
          paired_at?: string | null
          revoked_at?: string | null
          sim_last4?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          android_version?: string | null
          app_version?: string | null
          branch_id?: string | null
          created_at?: string
          device_manufacturer?: string | null
          device_model?: string | null
          id?: string
          label?: string
          last_seen_at?: string | null
          last_sync_at?: string | null
          merchant_id?: string
          paired_at?: string | null
          revoked_at?: string | null
          sim_last4?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_readers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_readers_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
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
      cancel_payment_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      confirm_payment_session: {
        Args: { _session_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_merchant_manager: { Args: { _merchant_id: string }; Returns: boolean }
      is_merchant_member: {
        Args: { _branch_id: string; _merchant_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
