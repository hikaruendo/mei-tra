export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      active_room_memberships: {
        Row: {
          created_at: string;
          last_seen_at: string;
          membership_version: number;
          room_id: string | null;
          seat_id: string;
          status: Database['public']['Enums']['active_room_membership_status'];
          transition_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          last_seen_at?: string;
          membership_version?: number;
          room_id?: string | null;
          seat_id: string;
          status: Database['public']['Enums']['active_room_membership_status'];
          transition_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          last_seen_at?: string;
          membership_version?: number;
          room_id?: string | null;
          seat_id?: string;
          status?: Database['public']['Enums']['active_room_membership_status'];
          transition_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'active_room_memberships_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'active_room_memberships_seat_same_room_fkey';
            columns: ['room_id', 'seat_id'];
            isOneToOne: false;
            referencedRelation: 'room_players';
            referencedColumns: ['room_id', 'id'];
          },
          {
            foreignKeyName: 'active_room_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_members: {
        Row: {
          id: string;
          joined_at: string | null;
          role: Database['public']['Enums']['chat_member_role'];
          room_id: string | null;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          joined_at?: string | null;
          role?: Database['public']['Enums']['chat_member_role'];
          room_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          joined_at?: string | null;
          role?: Database['public']['Enums']['chat_member_role'];
          room_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_members_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'chat_rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          content: string;
          content_type: Database['public']['Enums']['chat_content_type'];
          created_at: string | null;
          id: string;
          reply_to: string | null;
          room_id: string | null;
          sender_id: string | null;
        };
        Insert: {
          content: string;
          content_type?: Database['public']['Enums']['chat_content_type'];
          created_at?: string | null;
          id?: string;
          reply_to?: string | null;
          room_id?: string | null;
          sender_id?: string | null;
        };
        Update: {
          content?: string;
          content_type?: Database['public']['Enums']['chat_content_type'];
          created_at?: string | null;
          id?: string;
          reply_to?: string | null;
          room_id?: string | null;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_reply_to_fkey';
            columns: ['reply_to'];
            isOneToOne: false;
            referencedRelation: 'chat_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_messages_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'chat_rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_rooms: {
        Row: {
          created_at: string | null;
          id: string;
          message_ttl_hours: number;
          name: string | null;
          owner_id: string | null;
          scope: Database['public']['Enums']['chat_room_scope'];
          updated_at: string | null;
          visibility: Database['public']['Enums']['chat_room_visibility'];
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          message_ttl_hours?: number;
          name?: string | null;
          owner_id?: string | null;
          scope: Database['public']['Enums']['chat_room_scope'];
          updated_at?: string | null;
          visibility?: Database['public']['Enums']['chat_room_visibility'];
        };
        Update: {
          created_at?: string | null;
          id?: string;
          message_ttl_hours?: number;
          name?: string | null;
          owner_id?: string | null;
          scope?: Database['public']['Enums']['chat_room_scope'];
          updated_at?: string | null;
          visibility?: Database['public']['Enums']['chat_room_visibility'];
        };
        Relationships: [];
      };
      game_history: {
        Row: {
          action_data: Json | null;
          action_type: string;
          actor_key_snapshot: string | null;
          actor_seat_id: string | null;
          game_state_id: string | null;
          id: string;
          room_id: string | null;
          timestamp: string | null;
        };
        Insert: {
          action_data?: Json | null;
          action_type: string;
          actor_key_snapshot?: string | null;
          actor_seat_id?: string | null;
          game_state_id?: string | null;
          id?: string;
          room_id?: string | null;
          timestamp?: string | null;
        };
        Update: {
          action_data?: Json | null;
          action_type?: string;
          actor_key_snapshot?: string | null;
          actor_seat_id?: string | null;
          game_state_id?: string | null;
          id?: string;
          room_id?: string | null;
          timestamp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'game_history_actor_seat_same_room_fkey';
            columns: ['room_id', 'actor_seat_id'];
            isOneToOne: false;
            referencedRelation: 'room_players';
            referencedColumns: ['room_id', 'id'];
          },
          {
            foreignKeyName: 'game_history_game_state_id_fkey';
            columns: ['game_state_id'];
            isOneToOne: false;
            referencedRelation: 'game_states';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'game_history_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      game_participants: {
        Row: {
          created_at: string;
          id: string;
          joined_at: string;
          player_name_snapshot: string;
          room_id: string;
          seat_id: string;
          team_snapshot: number | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          joined_at?: string;
          player_name_snapshot: string;
          room_id: string;
          seat_id: string;
          team_snapshot?: number | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          joined_at?: string;
          player_name_snapshot?: string;
          room_id?: string;
          seat_id?: string;
          team_snapshot?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'game_participants_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      game_states: {
        Row: {
          created_at: string | null;
          current_seat_id: string | null;
          game_phase: Database['public']['Enums']['game_phase'] | null;
          id: string;
          points_to_win: number | null;
          room_id: string | null;
          round_number: number | null;
          state_data: Json;
          team_score_records: Json | null;
          team_scores: Json | null;
          updated_at: string | null;
          version: number;
        };
        Insert: {
          created_at?: string | null;
          current_seat_id?: string | null;
          game_phase?: Database['public']['Enums']['game_phase'] | null;
          id?: string;
          points_to_win?: number | null;
          room_id?: string | null;
          round_number?: number | null;
          state_data?: Json;
          team_score_records?: Json | null;
          team_scores?: Json | null;
          updated_at?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string | null;
          current_seat_id?: string | null;
          game_phase?: Database['public']['Enums']['game_phase'] | null;
          id?: string;
          points_to_win?: number | null;
          room_id?: string | null;
          round_number?: number | null;
          state_data?: Json;
          team_score_records?: Json | null;
          team_scores?: Json | null;
          updated_at?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'game_states_current_seat_same_room_fkey';
            columns: ['room_id', 'current_seat_id'];
            isOneToOne: false;
            referencedRelation: 'room_players';
            referencedColumns: ['room_id', 'id'];
          },
          {
            foreignKeyName: 'game_states_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: true;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      push_receipts: {
        Row: {
          attempt_count: number;
          created_at: string;
          device_id: string;
          expo_push_token: string;
          expo_receipt_id: string;
          id: string;
          locked_until: string | null;
          next_attempt_at: string;
          platform: string;
          processed_at: string | null;
          provider_error_code: string | null;
          push_token_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          worker_id: string | null;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          device_id: string;
          expo_push_token: string;
          expo_receipt_id: string;
          id?: string;
          locked_until?: string | null;
          next_attempt_at?: string;
          platform: string;
          processed_at?: string | null;
          provider_error_code?: string | null;
          push_token_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          worker_id?: string | null;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          device_id?: string;
          expo_push_token?: string;
          expo_receipt_id?: string;
          id?: string;
          locked_until?: string | null;
          next_attempt_at?: string;
          platform?: string;
          processed_at?: string | null;
          provider_error_code?: string | null;
          push_token_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'push_receipts_push_token_id_fkey';
            columns: ['push_token_id'];
            isOneToOne: false;
            referencedRelation: 'push_tokens';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          app_version: string | null;
          created_at: string;
          device_id: string;
          expo_push_token: string;
          id: string;
          last_seen_at: string;
          platform: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          device_id: string;
          expo_push_token: string;
          id?: string;
          last_seen_at?: string;
          platform: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          device_id?: string;
          expo_push_token?: string;
          id?: string;
          last_seen_at?: string;
          platform?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      room_membership_events: {
        Row: {
          created_at: string;
          event_type: string;
          from_room_id: string | null;
          id: number;
          membership_version: number | null;
          metadata: Json;
          seat_id: string | null;
          to_room_id: string | null;
          transition_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          from_room_id?: string | null;
          id?: number;
          membership_version?: number | null;
          metadata?: Json;
          seat_id?: string | null;
          to_room_id?: string | null;
          transition_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          from_room_id?: string | null;
          id?: number;
          membership_version?: number | null;
          metadata?: Json;
          seat_id?: string | null;
          to_room_id?: string | null;
          transition_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'room_membership_events_from_room_id_fkey';
            columns: ['from_room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'room_membership_events_seat_fkey';
            columns: ['seat_id'];
            isOneToOne: false;
            referencedRelation: 'room_players';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'room_membership_events_to_room_id_fkey';
            columns: ['to_room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'room_membership_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      room_players: {
        Row: {
          id: string;
          is_com: boolean;
          is_ready: boolean | null;
          joined_at: string | null;
          name: string;
          room_id: string | null;
          seat_index: number;
          team: number;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          is_com?: boolean;
          is_ready?: boolean | null;
          joined_at?: string | null;
          name: string;
          room_id?: string | null;
          seat_index: number;
          team?: number;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          is_com?: boolean;
          is_ready?: boolean | null;
          joined_at?: string | null;
          name?: string;
          room_id?: string | null;
          seat_index?: number;
          team?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'room_players_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'room_players_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rooms: {
        Row: {
          created_at: string | null;
          host_seat_id: string | null;
          id: string;
          last_activity_at: string | null;
          name: string;
          settings: Json;
          status: Database['public']['Enums']['room_status'];
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          host_seat_id?: string | null;
          id?: string;
          last_activity_at?: string | null;
          name: string;
          settings?: Json;
          status?: Database['public']['Enums']['room_status'];
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          host_seat_id?: string | null;
          id?: string;
          last_activity_at?: string | null;
          name?: string;
          settings?: Json;
          status?: Database['public']['Enums']['room_status'];
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rooms_host_seat_same_room_fkey';
            columns: ['id', 'host_seat_id'];
            isOneToOne: false;
            referencedRelation: 'room_players';
            referencedColumns: ['room_id', 'id'];
          },
        ];
      };
      user_profiles: {
        Row: {
          account_deletion_started_at: string | null;
          avatar_url: string | null;
          created_at: string | null;
          display_name: string;
          games_played: number | null;
          games_won: number | null;
          id: string;
          last_seen_at: string | null;
          preferences: Json | null;
          total_score: number | null;
          updated_at: string | null;
          username: string;
        };
        Insert: {
          account_deletion_started_at?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          display_name: string;
          games_played?: number | null;
          games_won?: number | null;
          id: string;
          last_seen_at?: string | null;
          preferences?: Json | null;
          total_score?: number | null;
          updated_at?: string | null;
          username: string;
        };
        Update: {
          account_deletion_started_at?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string;
          games_played?: number | null;
          games_won?: number | null;
          id?: string;
          last_seen_at?: string | null;
          preferences?: Json | null;
          total_score?: number | null;
          updated_at?: string | null;
          username?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      anonymize_account_references: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      atomic_update_game_state: {
        Args: {
          p_expected_version?: number;
          p_room_id: string;
          p_scalar_patch?: Json;
          p_state_patch?: Json;
        };
        Returns: Json;
      };
      cancel_room_membership_reservation: {
        Args: { p_transition_id: string; p_user_id: string };
        Returns: boolean;
      };
      claim_push_receipts: {
        Args: { p_limit: number; p_lock_seconds: number; p_worker_id: string };
        Returns: {
          attempt_count: number;
          created_at: string;
          device_id: string;
          expo_push_token: string;
          expo_receipt_id: string;
          id: string;
          locked_until: string | null;
          next_attempt_at: string;
          platform: string;
          processed_at: string | null;
          provider_error_code: string | null;
          push_token_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          worker_id: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'push_receipts';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_room_membership: {
        Args: {
          p_room_id: string;
          p_seat_id: string;
          p_transition_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      cleanup_abandoned_private_rooms: { Args: never; Returns: undefined };
      cleanup_old_game_data: { Args: never; Returns: undefined };
      cleanup_stale_anonymous_users: { Args: never; Returns: undefined };
      complete_push_receipt: {
        Args: {
          p_provider_error_code?: string;
          p_receipt_row_id: string;
          p_status: string;
          p_worker_id: string;
        };
        Returns: boolean;
      };
      create_room_with_host_seat_atomic: {
        Args: {
          p_host_name: string;
          p_host_seat_id: string;
          p_host_user_id: string;
          p_points_to_win: number;
          p_room_id: string;
          p_room_name: string;
          p_room_settings: Json;
          p_transition_id: string;
        };
        Returns: Json;
      };
      finish_room_membership_timeout: {
        Args: {
          p_expected_version: number;
          p_room_id: string;
          p_succeeded: boolean;
          p_transition_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      load_room_game_state: { Args: { p_room_id: string }; Returns: Json };
      mark_account_deletion_started: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      mark_room_membership_disconnected: {
        Args: {
          p_expected_version: number;
          p_room_id: string;
          p_transition_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      persist_room_roster_atomic: {
        Args: {
          p_expected_version?: number;
          p_host_id?: string;
          p_membership_mutation?: Json;
          p_player_states: Json;
          p_room_id: string;
          p_room_players: Json;
          p_scalar_patch?: Json;
          p_state_patch?: Json;
        };
        Returns: Json;
      };
      release_room_membership: {
        Args: {
          p_expected_version: number;
          p_room_id: string;
          p_transition_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      release_room_membership_by_seat: {
        Args: { p_room_id: string; p_seat_id: string; p_transition_id: string };
        Returns: boolean;
      };
      release_room_memberships_for_room: {
        Args: { p_room_id: string; p_transition_id: string };
        Returns: number;
      };
      release_stale_room_membership: {
        Args: {
          p_membership: Database['public']['Tables']['active_room_memberships']['Row'];
          p_transition_id: string;
        };
        Returns: boolean;
      };
      reschedule_push_receipt: {
        Args: {
          p_next_attempt_at: string;
          p_provider_error_code?: string;
          p_receipt_row_id: string;
          p_worker_id: string;
        };
        Returns: boolean;
      };
      reserve_room_membership: {
        Args: { p_seat_id: string; p_transition_id: string; p_user_id: string };
        Returns: Json;
      };
      start_room_membership_timeout: {
        Args: {
          p_expected_version: number;
          p_room_id: string;
          p_transition_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      update_user_last_seen: {
        Args: { user_uuid: string };
        Returns: undefined;
      };
      upsert_push_token: {
        Args: {
          p_app_version?: string;
          p_device_id: string;
          p_expo_push_token: string;
          p_platform: string;
          p_user_id: string;
        };
        Returns: {
          app_version: string | null;
          created_at: string;
          device_id: string;
          expo_push_token: string;
          id: string;
          last_seen_at: string;
          platform: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'push_tokens';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      active_room_membership_status: 'moving' | 'active' | 'disconnected';
      chat_content_type: 'text' | 'emoji' | 'system';
      chat_member_role: 'member' | 'moderator';
      chat_room_scope: 'global' | 'lobby' | 'table' | 'private';
      chat_room_visibility: 'public' | 'friends' | 'private';
      game_phase: 'deal' | 'blow' | 'play' | 'waiting';
      room_status: 'waiting' | 'ready' | 'playing' | 'finished' | 'abandoned';
      team_assignment_method: 'random' | 'host-choice';
      trump_type: 'tra' | 'herz' | 'daiya' | 'club' | 'zuppe';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      active_room_membership_status: ['moving', 'active', 'disconnected'],
      chat_content_type: ['text', 'emoji', 'system'],
      chat_member_role: ['member', 'moderator'],
      chat_room_scope: ['global', 'lobby', 'table', 'private'],
      chat_room_visibility: ['public', 'friends', 'private'],
      game_phase: ['deal', 'blow', 'play', 'waiting'],
      room_status: ['waiting', 'ready', 'playing', 'finished', 'abandoned'],
      team_assignment_method: ['random', 'host-choice'],
      trump_type: ['tra', 'herz', 'daiya', 'club', 'zuppe'],
    },
  },
} as const;
