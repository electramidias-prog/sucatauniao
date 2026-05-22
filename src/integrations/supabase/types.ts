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
      calendar_events: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          reminder_days: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          reminder_days?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          reminder_days?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          channel: string
          content: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel: string
          content?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel?: string
          content?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_reads: {
        Row: {
          channel: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_records: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string | null
          equipment_id: string | null
          id: string
          observations: string | null
          pdf_url: string | null
          photo_url: string | null
          record_date: string
          responses: Json
          result: string
          supervisor_id: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          equipment_id?: string | null
          id?: string
          observations?: string | null
          pdf_url?: string | null
          photo_url?: string | null
          record_date?: string
          responses?: Json
          result?: string
          supervisor_id?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          equipment_id?: string | null
          id?: string
          observations?: string | null
          pdf_url?: string | null
          photo_url?: string | null
          record_date?: string
          responses?: Json
          result?: string
          supervisor_id?: string | null
          template_id?: string
        }
        Relationships: []
      }
      checklist_signatures: {
        Row: {
          created_at: string
          id: string
          person_name: string
          record_id: string
          role: string | null
          signature_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          person_name: string
          record_id: string
          role?: string | null
          signature_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          person_name?: string
          record_id?: string
          role?: string | null
          signature_url?: string | null
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_types: string[]
          id: string
          items: Json
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_types?: string[]
          id?: string
          items?: Json
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_types?: string[]
          id?: string
          items?: Json
          name?: string
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
          qr_code_url: string | null
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
          qr_code_url?: string | null
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
          qr_code_url?: string | null
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
        Relationships: [
          {
            foreignKeyName: "clients_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "portal_credentials"
            referencedColumns: ["id"]
          },
        ]
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
      dds_attendance: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          present: boolean
          session_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          present?: boolean
          session_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          present?: boolean
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dds_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dds_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dds_operation_mode: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ended_at: string | null
          expected_end_date: string | null
          id: string
          mode: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          expected_end_date?: string | null
          id?: string
          mode?: string
          reason?: string | null
          start_date?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          expected_end_date?: string | null
          id?: string
          mode?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: []
      }
      dds_sessions: {
        Row: {
          ata_pdf_url: string | null
          attendance_photo_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          frequency_type: string
          id: string
          location: string | null
          session_date: string
          session_time: string | null
          summary: string | null
          supervisor_id: string | null
          theme_id: string | null
          theme_title: string
        }
        Insert: {
          ata_pdf_url?: string | null
          attendance_photo_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          frequency_type?: string
          id?: string
          location?: string | null
          session_date: string
          session_time?: string | null
          summary?: string | null
          supervisor_id?: string | null
          theme_id?: string | null
          theme_title: string
        }
        Update: {
          ata_pdf_url?: string | null
          attendance_photo_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          frequency_type?: string
          id?: string
          location?: string | null
          session_date?: string
          session_time?: string | null
          summary?: string | null
          supervisor_id?: string | null
          theme_id?: string | null
          theme_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dds_sessions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "dds_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      dds_themes: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          last_addressed_at: string | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          last_addressed_at?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          last_addressed_at?: string | null
          title?: string
        }
        Relationships: []
      }
      employee_asos: {
        Row: {
          aso_date: string | null
          aso_type: string
          created_at: string
          doctor_crm: string | null
          doctor_name: string | null
          document_url: string | null
          employee_id: string
          expiry_date: string | null
          id: string
        }
        Insert: {
          aso_date?: string | null
          aso_type: string
          created_at?: string
          doctor_crm?: string | null
          doctor_name?: string | null
          document_url?: string | null
          employee_id: string
          expiry_date?: string | null
          id?: string
        }
        Update: {
          aso_date?: string | null
          aso_type?: string
          created_at?: string
          doctor_crm?: string | null
          doctor_name?: string | null
          document_url?: string | null
          employee_id?: string
          expiry_date?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_asos_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_trainings: {
        Row: {
          certificate_url: string | null
          created_at: string
          employee_id: string
          expiry_date: string | null
          id: string
          instructor: string | null
          nr_code: string
          training_date: string | null
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          employee_id: string
          expiry_date?: string | null
          id?: string
          instructor?: string | null
          nr_code: string
          training_date?: string | null
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          employee_id?: string
          expiry_date?: string | null
          id?: string
          instructor?: string | null
          nr_code?: string
          training_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          admission_date: string | null
          base_salary: number | null
          birth_date: string | null
          cbo_code: string | null
          contract_type: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          rg: string | null
          role_title: string | null
          sector: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          base_salary?: number | null
          birth_date?: string | null
          cbo_code?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          role_title?: string | null
          sector?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          base_salary?: number | null
          birth_date?: string | null
          cbo_code?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          role_title?: string | null
          sector?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      epi_deliveries: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          epi_id: string
          id: string
          observation: string | null
          quantity: number
          reason: string
          receipt_pdf_url: string | null
          signature_url: string | null
          size: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          epi_id: string
          id?: string
          observation?: string | null
          quantity?: number
          reason?: string
          receipt_pdf_url?: string | null
          signature_url?: string | null
          size?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          epi_id?: string
          id?: string
          observation?: string | null
          quantity?: number
          reason?: string
          receipt_pdf_url?: string | null
          signature_url?: string | null
          size?: string | null
        }
        Relationships: []
      }
      epi_inflows: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          epi_id: string
          id: string
          invoice: string | null
          quantity: number
          supplier: string | null
          total_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          epi_id: string
          id?: string
          invoice?: string | null
          quantity?: number
          supplier?: string | null
          total_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          epi_id?: string
          id?: string
          invoice?: string | null
          quantity?: number
          supplier?: string | null
          total_cost?: number | null
        }
        Relationships: []
      }
      epis: {
        Row: {
          ca_expiry: string | null
          ca_number: string | null
          category: string
          created_at: string
          created_by: string | null
          id: string
          min_quantity: number
          name: string
          photo_url: string | null
          quantity: number
          supplier: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          ca_expiry?: string | null
          ca_number?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          min_quantity?: number
          name: string
          photo_url?: string | null
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          ca_expiry?: string | null
          ca_number?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          min_quantity?: number
          name?: string
          photo_url?: string | null
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          brand: string | null
          created_at: string
          created_by: string | null
          id: string
          inmetro_cert: string | null
          inmetro_date: string | null
          inmetro_expiry: string | null
          inmetro_pdf_url: string | null
          last_checklist_at: string | null
          maintenance_frequency: string | null
          model: string | null
          name: string
          next_maintenance: string | null
          nr12_art: string | null
          nr12_date: string | null
          nr12_expiry: string | null
          nr12_pdf_url: string | null
          nr12_technician: string | null
          patrimony: string | null
          photo_url: string | null
          plate: string | null
          responsible_id: string | null
          sector: string | null
          serial_number: string | null
          status: string
          type: string
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inmetro_cert?: string | null
          inmetro_date?: string | null
          inmetro_expiry?: string | null
          inmetro_pdf_url?: string | null
          last_checklist_at?: string | null
          maintenance_frequency?: string | null
          model?: string | null
          name: string
          next_maintenance?: string | null
          nr12_art?: string | null
          nr12_date?: string | null
          nr12_expiry?: string | null
          nr12_pdf_url?: string | null
          nr12_technician?: string | null
          patrimony?: string | null
          photo_url?: string | null
          plate?: string | null
          responsible_id?: string | null
          sector?: string | null
          serial_number?: string | null
          status?: string
          type: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          inmetro_cert?: string | null
          inmetro_date?: string | null
          inmetro_expiry?: string | null
          inmetro_pdf_url?: string | null
          last_checklist_at?: string | null
          maintenance_frequency?: string | null
          model?: string | null
          name?: string
          next_maintenance?: string | null
          nr12_art?: string | null
          nr12_date?: string | null
          nr12_expiry?: string | null
          nr12_pdf_url?: string | null
          nr12_technician?: string | null
          patrimony?: string | null
          photo_url?: string | null
          plate?: string | null
          responsible_id?: string | null
          sector?: string | null
          serial_number?: string | null
          status?: string
          type?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      equipment_documents: {
        Row: {
          created_at: string
          document_url: string | null
          equipment_id: string
          expiry_date: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          equipment_id: string
          expiry_date?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          equipment_id?: string
          expiry_date?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          document_number: string | null
          id: string
          invoice_id: string
          item_date: string | null
          service_type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          document_number?: string | null
          id?: string
          invoice_id: string
          item_date?: string | null
          service_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          document_number?: string | null
          id?: string
          invoice_id?: string
          item_date?: string | null
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: number
          observations: string | null
          paid_at: string | null
          pdf_url: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number?: number
          observations?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: number
          observations?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_records: {
        Row: {
          attachments: string[] | null
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          equipment_id: string
          id: string
          maintenance_date: string
          next_maintenance: string | null
          parts_replaced: string | null
          responsible_id: string | null
          type: string
        }
        Insert: {
          attachments?: string[] | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id: string
          id?: string
          maintenance_date?: string
          next_maintenance?: string | null
          parts_replaced?: string | null
          responsible_id?: string | null
          type?: string
        }
        Update: {
          attachments?: string[] | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id?: string
          id?: string
          maintenance_date?: string
          next_maintenance?: string | null
          parts_replaced?: string | null
          responsible_id?: string | null
          type?: string
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
      portal_credentials: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          password_hash: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          password_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_login_attempts: {
        Row: {
          attempted_at: string
          email: string | null
          id: string
          ip_address: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email?: string | null
          id?: string
          ip_address: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string | null
          id?: string
          ip_address?: string
          success?: boolean
        }
        Relationships: []
      }
      portal_sessions: {
        Row: {
          client_id: string
          created_at: string
          credential_id: string | null
          expires_at: string
          id: string
          ip_address: string | null
          last_activity_at: string
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          credential_id?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string
          token?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          credential_id?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_sessions_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "portal_credentials"
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
      stock_items: {
        Row: {
          carreta_target_kg: number
          current_quantity_kg: number
          id: string
          last_entry_at: string | null
          last_exit_at: string | null
          material_type: string
          price_per_kg: number
          updated_at: string
        }
        Insert: {
          carreta_target_kg?: number
          current_quantity_kg?: number
          id?: string
          last_entry_at?: string | null
          last_exit_at?: string | null
          material_type: string
          price_per_kg?: number
          updated_at?: string
        }
        Update: {
          carreta_target_kg?: number
          current_quantity_kg?: number
          id?: string
          last_entry_at?: string | null
          last_exit_at?: string | null
          material_type?: string
          price_per_kg?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          adjustment_reason: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          id: string
          invoice_number: string | null
          material_type: string
          movement_type: string
          observation: string | null
          origin_id: string | null
          origin_type: string | null
          quantity_kg: number
          responsible_id: string | null
        }
        Insert: {
          adjustment_reason?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          invoice_number?: string | null
          material_type: string
          movement_type: string
          observation?: string | null
          origin_id?: string | null
          origin_type?: string | null
          quantity_kg: number
          responsible_id?: string | null
        }
        Update: {
          adjustment_reason?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          id?: string
          invoice_number?: string | null
          material_type?: string
          movement_type?: string
          observation?: string | null
          origin_id?: string | null
          origin_type?: string | null
          quantity_kg?: number
          responsible_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
      weighing_fractions: {
        Row: {
          created_at: string
          created_by: string | null
          current_tare: number
          discount_type: string | null
          discount_value: number
          final_weight: number
          id: string
          material_type: string
          net_weight: number
          photo_url: string | null
          previous_weight: number
          price_per_kg: number
          sequence_number: number
          subtotal: number
          weighing_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_tare?: number
          discount_type?: string | null
          discount_value?: number
          final_weight?: number
          id?: string
          material_type: string
          net_weight?: number
          photo_url?: string | null
          previous_weight?: number
          price_per_kg?: number
          sequence_number: number
          subtotal?: number
          weighing_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_tare?: number
          discount_type?: string | null
          discount_value?: number
          final_weight?: number
          id?: string
          material_type?: string
          net_weight?: number
          photo_url?: string | null
          previous_weight?: number
          price_per_kg?: number
          sequence_number?: number
          subtotal?: number
          weighing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weighing_fractions_weighing_id_fkey"
            columns: ["weighing_id"]
            isOneToOne: false
            referencedRelation: "weighings"
            referencedColumns: ["id"]
          },
        ]
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
          material_type: string | null
          net_weight: number | null
          notes: string | null
          photo_url: string | null
          price_per_kg: number
          settlement_id: string | null
          status: string
          tare_weight: number
          ticket_number: number
          total_value: number | null
          total_weight: number
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
          material_type?: string | null
          net_weight?: number | null
          notes?: string | null
          photo_url?: string | null
          price_per_kg?: number
          settlement_id?: string | null
          status?: string
          tare_weight?: number
          ticket_number?: number
          total_value?: number | null
          total_weight?: number
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
          material_type?: string | null
          net_weight?: number | null
          notes?: string | null
          photo_url?: string | null
          price_per_kg?: number
          settlement_id?: string | null
          status?: string
          tare_weight?: number
          ticket_number?: number
          total_value?: number | null
          total_weight?: number
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
      can_access_chat_channel: {
        Args: { _channel: string; _user_id: string }
        Returns: boolean
      }
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
