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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          obs: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          recurrence: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          obs?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          obs?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_change_requests: {
        Row: {
          client_id: string
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_change_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_pix_keys: {
        Row: {
          bank_name: string | null
          client_id: string
          created_at: string
          holder_name: string | null
          id: string
          is_favorite: boolean
          key_type: string
          key_value: string
          usage_count: number
        }
        Insert: {
          bank_name?: string | null
          client_id: string
          created_at?: string
          holder_name?: string | null
          id?: string
          is_favorite?: boolean
          key_type?: string
          key_value: string
          usage_count?: number
        }
        Update: {
          bank_name?: string | null
          client_id?: string
          created_at?: string
          holder_name?: string | null
          id?: string
          is_favorite?: boolean
          key_type?: string
          key_value?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_pix_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_transactions: {
        Row: {
          amortecedor_kg: number | null
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          description: string
          fundido_kg: number | null
          id: string
          limaria_kg: number | null
          mista_kg: number | null
          pesada_kg: number | null
          price_used: number | null
          settlement_id: string | null
          status: string
          ticket_number: number | null
          total_kg: number | null
          transaction_date: string | null
          type: string
          value: number | null
        }
        Insert: {
          amortecedor_kg?: number | null
          amount?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          description: string
          fundido_kg?: number | null
          id?: string
          limaria_kg?: number | null
          mista_kg?: number | null
          pesada_kg?: number | null
          price_used?: number | null
          settlement_id?: string | null
          status?: string
          ticket_number?: number | null
          total_kg?: number | null
          transaction_date?: string | null
          type?: string
          value?: number | null
        }
        Update: {
          amortecedor_kg?: number | null
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          fundido_kg?: number | null
          id?: string
          limaria_kg?: number | null
          mista_kg?: number | null
          pesada_kg?: number | null
          price_used?: number | null
          settlement_id?: string | null
          status?: string
          ticket_number?: number | null
          total_kg?: number | null
          transaction_date?: string | null
          type?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_transactions_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "payment_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          birth_date: string | null
          client_type: string
          created_at: string
          created_by: string | null
          document_number: string
          document_type: string
          email: string | null
          id: string
          municipal_registration: string | null
          name: string
          negotiation_history: string | null
          nickname: string | null
          notes: string | null
          operational_status: string
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          portal_access_enabled: boolean
          portal_user_id: string | null
          rg: string | null
          source: string | null
          state_registration: string | null
          status: string
          tags: string[] | null
          trade_name: string | null
          updated_at: string
          vehicle_plate: string | null
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          client_type?: string
          created_at?: string
          created_by?: string | null
          document_number: string
          document_type?: string
          email?: string | null
          id?: string
          municipal_registration?: string | null
          name: string
          negotiation_history?: string | null
          nickname?: string | null
          notes?: string | null
          operational_status?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          portal_access_enabled?: boolean
          portal_user_id?: string | null
          rg?: string | null
          source?: string | null
          state_registration?: string | null
          status?: string
          tags?: string[] | null
          trade_name?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          client_type?: string
          created_at?: string
          created_by?: string | null
          document_number?: string
          document_type?: string
          email?: string | null
          id?: string
          municipal_registration?: string | null
          name?: string
          negotiation_history?: string | null
          nickname?: string | null
          notes?: string | null
          operational_status?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          portal_access_enabled?: boolean
          portal_user_id?: string | null
          rg?: string | null
          source?: string | null
          state_registration?: string | null
          status?: string
          tags?: string[] | null
          trade_name?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          name: string
          obs: string | null
          protocol_number: string | null
          responsible: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          name: string
          obs?: string | null
          protocol_number?: string | null
          responsible?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          name?: string
          obs?: string | null
          protocol_number?: string | null
          responsible?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      material_prices: {
        Row: {
          id: string
          material_type: string
          price_per_kg: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          material_type: string
          price_per_kg?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          material_type?: string
          price_per_kg?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_settlements: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          holder_name: string | null
          id: string
          net_amount: number
          notes: string | null
          pix_key_display: string | null
          pix_key_id: string | null
          status: string
          total_deductions: number
          total_materials: number
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          holder_name?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          pix_key_display?: string | null
          pix_key_id?: string | null
          status?: string
          total_deductions?: number
          total_materials?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          holder_name?: string | null
          id?: string
          net_amount?: number
          notes?: string | null
          pix_key_display?: string | null
          pix_key_id?: string | null
          status?: string
          total_deductions?: number
          total_materials?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_settlements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_settlements_pix_key_id_fkey"
            columns: ["pix_key_id"]
            isOneToOne: false
            referencedRelation: "client_pix_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weighings: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          discount_type: string | null
          discount_value: number | null
          final_net_weight: number | null
          gross_weight: number
          id: string
          material_type: string
          net_weight: number | null
          notes: string | null
          photo_url: string | null
          price_per_kg: number
          settlement_id: string | null
          status: string
          tare_weight: number
          ticket_number: number
          total_value: number | null
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          final_net_weight?: number | null
          gross_weight?: number
          id?: string
          material_type?: string
          net_weight?: number | null
          notes?: string | null
          photo_url?: string | null
          price_per_kg?: number
          settlement_id?: string | null
          status?: string
          tare_weight?: number
          ticket_number?: number
          total_value?: number | null
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          final_net_weight?: number | null
          gross_weight?: number
          id?: string
          material_type?: string
          net_weight?: number | null
          notes?: string | null
          photo_url?: string | null
          price_per_kg?: number
          settlement_id?: string | null
          status?: string
          tare_weight?: number
          ticket_number?: number
          total_value?: number | null
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weighings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighings_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "payment_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "financeiro"
        | "operador_balanca"
        | "conferente"
        | "contador"
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
        "admin",
        "financeiro",
        "operador_balanca",
        "conferente",
        "contador",
      ],
    },
  },
} as const
