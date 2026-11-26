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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_demo: boolean
          logo_url: string | null
          name: string
          promo_text: string | null
          segment: Database["public"]["Enums"]["brand_segment"]
          slug: string
          sort_order: number
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          logo_url?: string | null
          name: string
          promo_text?: string | null
          segment?: Database["public"]["Enums"]["brand_segment"]
          slug: string
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          promo_text?: string | null
          segment?: Database["public"]["Enums"]["brand_segment"]
          slug?: string
          sort_order?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      case_item_events: {
        Row: {
          case_item_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["part_status"] | null
          id: string
          is_correction: boolean
          note: string | null
          to_status: Database["public"]["Enums"]["part_status"]
        }
        Insert: {
          case_item_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["part_status"] | null
          id?: string
          is_correction?: boolean
          note?: string | null
          to_status: Database["public"]["Enums"]["part_status"]
        }
        Update: {
          case_item_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["part_status"] | null
          id?: string
          is_correction?: boolean
          note?: string | null
          to_status?: Database["public"]["Enums"]["part_status"]
        }
        Relationships: [
          {
            foreignKeyName: "case_item_events_case_item_id_fkey"
            columns: ["case_item_id"]
            isOneToOne: false
            referencedRelation: "case_items"
            referencedColumns: ["id"]
          },
        ]
      }
      case_items: {
        Row: {
          case_id: string
          created_at: string
          description: string
          eta: string | null
          id: string
          observations: string | null
          part_code: string | null
          quantity: number
          status: Database["public"]["Enums"]["part_status"]
          status_date: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          description: string
          eta?: string | null
          id?: string
          observations?: string | null
          part_code?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["part_status"]
          status_date?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          description?: string
          eta?: string | null
          id?: string
          observations?: string | null
          part_code?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["part_status"]
          status_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          title: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          case_number?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          case_number?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_key: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_key?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_key?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      operator_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["operator_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["operator_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["operator_permission"]
          user_id?: string
        }
        Relationships: []
      }
      order_requests: {
        Row: {
          address: string | null
          city: string | null
          contact_phone: string | null
          created_at: string
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          department: string | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          staff_note: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_uyu: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          department?: string | null
          id?: string
          items: Json
          notes?: string | null
          order_number?: string
          staff_note?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_uyu?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          department?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          staff_note?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_uyu?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ownership_transfers: {
        Row: {
          created_at: string
          document_paths: string[]
          id: string
          message: string | null
          plate: string | null
          requester_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          updated_at: string
          vin: string
        }
        Insert: {
          created_at?: string
          document_paths?: string[]
          id?: string
          message?: string | null
          plate?: string | null
          requester_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          updated_at?: string
          vin: string
        }
        Update: {
          created_at?: string
          document_paths?: string[]
          id?: string
          message?: string | null
          plate?: string | null
          requester_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          updated_at?: string
          vin?: string
        }
        Relationships: []
      }
      product_compatibilities: {
        Row: {
          id: string
          model_id: string
          notes: string | null
          product_id: string
          year_from: number
          year_to: number
        }
        Insert: {
          id?: string
          model_id: string
          notes?: string | null
          product_id: string
          year_from: number
          year_to: number
        }
        Update: {
          id?: string
          model_id?: string
          notes?: string | null
          product_id?: string
          year_from?: number
          year_to?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_compatibilities_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibilities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          availability: Database["public"]["Enums"]["availability"]
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          homologation_reference: string | null
          honda_code: string | null
          honda_relation: Database["public"]["Enums"]["honda_relation"] | null
          id: string
          image_url: string | null
          is_demo: boolean
          name: string
          price_uyu: number | null
          promo_text: string | null
          sku: string
          stock: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          availability?: Database["public"]["Enums"]["availability"]
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          homologation_reference?: string | null
          honda_code?: string | null
          honda_relation?: Database["public"]["Enums"]["honda_relation"] | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          name: string
          price_uyu?: number | null
          promo_text?: string | null
          sku: string
          stock?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          availability?: Database["public"]["Enums"]["availability"]
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          homologation_reference?: string | null
          honda_code?: string | null
          honda_relation?: Database["public"]["Enums"]["honda_relation"] | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          name?: string
          price_uyu?: number | null
          promo_text?: string | null
          sku?: string
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          document_id: string
          email: string
          full_name: string
          id: string
          phone: string
          status_note: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          document_id?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          status_note?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          document_id?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          status_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          part_code: string | null
          quantity: number
          quote_id: string
          status: Database["public"]["Enums"]["quote_item_status"]
          unit_price_uyu: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          part_code?: string | null
          quantity?: number
          quote_id: string
          status?: Database["public"]["Enums"]["quote_item_status"]
          unit_price_uyu?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          part_code?: string | null
          quantity?: number
          quote_id?: string
          status?: Database["public"]["Enums"]["quote_item_status"]
          unit_price_uyu?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          observations: string | null
          quote_date: string
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          valid_until: string | null
          vehicle_description: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          observations?: string | null
          quote_date?: string
          quote_number: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          valid_until?: string | null
          vehicle_description?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          observations?: string | null
          quote_date?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          valid_until?: string | null
          vehicle_description?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_models: {
        Row: {
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          model_id: string | null
          model_other: string | null
          owner_id: string | null
          owner_since: string | null
          plate: string | null
          updated_at: string
          verified: boolean
          vin: string
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          model_id?: string | null
          model_other?: string | null
          owner_id?: string | null
          owner_since?: string | null
          plate?: string | null
          updated_at?: string
          verified?: boolean
          vin: string
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string | null
          model_other?: string | null
          owner_id?: string | null
          owner_since?: string | null
          plate?: string | null
          updated_at?: string
          verified?: boolean
          vin?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      lookup_customer_case: {
        Args: { _case_min: string }
        Returns: Json | null
      }
      import_customer_case_snapshots: {
        Args: { _rows: Json }
        Returns: number
      }
      approve_ownership_transfer: {
        Args: { _note?: string; _transfer_id: string }
        Returns: undefined
      }
      can_view_vehicle_record: {
        Args: { _customer_id: string; _user_id: string; _vehicle_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["operator_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_enabled_customer: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      search_products: {
        Args: {
          _brand?: string
          _category?: string
          _model?: string
          _q?: string
          _year?: number
        }
        Returns: {
          active: boolean
          availability: Database["public"]["Enums"]["availability"]
          brand_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          homologation_reference: string | null
          honda_code: string | null
          honda_relation: Database["public"]["Enums"]["honda_relation"] | null
          id: string
          image_url: string | null
          is_demo: boolean
          name: string
          price_uyu: number | null
          promo_text: string | null
          sku: string
          stock: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      account_status:
        | "pendiente_validacion"
        | "en_revision"
        | "habilitada"
        | "rechazada"
        | "correccion_solicitada"
      app_role: "admin" | "operador" | "cliente"
      availability:
        | "en_stock"
        | "pocas_unidades"
        | "a_pedido"
        | "sin_stock"
        | "consultar"
      brand_segment:
        | "neumaticos"
        | "baterias"
        | "lubricantes"
        | "accesorios"
        | "otros"
      delivery_method: "envio_uruguay" | "retiro_coordinar"
      honda_relation: "homologado_honda" | "compatible" | "recomendado"
      operator_permission:
        | "catalogo"
        | "clientes"
        | "casos"
        | "presupuestos"
        | "titularidad"
        | "pedidos"
      order_status: "recibida" | "en_revision" | "confirmada" | "cancelada"
      part_status:
        | "pendiente_fabrica"
        | "en_transito"
        | "liberacion_aduanas"
        | "en_recepcion"
        | "arribado"
        | "despachado"
        | "entregado"
      quote_item_status: "pendiente" | "comprado" | "no_comprado" | "anulado"
      quote_status:
        | "pendiente_decision"
        | "comprado_parcial"
        | "comprado"
        | "vencido"
        | "anulado"
      transfer_status:
        | "pendiente_revision"
        | "en_verificacion"
        | "documentacion_solicitada"
        | "aprobada"
        | "rechazada"
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
      account_status: [
        "pendiente_validacion",
        "en_revision",
        "habilitada",
        "rechazada",
        "correccion_solicitada",
      ],
      app_role: ["admin", "operador", "cliente"],
      availability: [
        "en_stock",
        "pocas_unidades",
        "a_pedido",
        "sin_stock",
        "consultar",
      ],
      brand_segment: [
        "neumaticos",
        "baterias",
        "lubricantes",
        "accesorios",
        "otros",
      ],
      delivery_method: ["envio_uruguay", "retiro_coordinar"],
      honda_relation: ["homologado_honda", "compatible", "recomendado"],
      operator_permission: [
        "catalogo",
        "clientes",
        "casos",
        "presupuestos",
        "titularidad",
        "pedidos",
      ],
      order_status: ["recibida", "en_revision", "confirmada", "cancelada"],
      part_status: [
        "pendiente_fabrica",
        "en_transito",
        "liberacion_aduanas",
        "en_recepcion",
        "arribado",
        "despachado",
        "entregado",
      ],
      quote_item_status: ["pendiente", "comprado", "no_comprado", "anulado"],
      quote_status: [
        "pendiente_decision",
        "comprado_parcial",
        "comprado",
        "vencido",
        "anulado",
      ],
      transfer_status: [
        "pendiente_revision",
        "en_verificacion",
        "documentacion_solicitada",
        "aprobada",
        "rechazada",
      ],
    },
  },
} as const
