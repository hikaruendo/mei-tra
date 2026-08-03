export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          name: string;
          host_id: string;
          status: 'waiting' | 'ready' | 'playing' | 'finished' | 'abandoned';
          settings: {
            maxPlayers: number;
            isPrivate: boolean;
            password: string | null;
            teamAssignmentMethod: 'random' | 'host-choice';
            pointsToWin: number;
            allowSpectators: boolean;
            teamNames?: {
              0?: string;
              1?: string;
            };
          };
          created_at: string;
          updated_at: string;
          last_activity_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          host_id: string;
          status?: 'waiting' | 'ready' | 'playing' | 'finished' | 'abandoned';
          settings?: {
            maxPlayers?: number;
            isPrivate?: boolean;
            password?: string | null;
            teamAssignmentMethod?: 'random' | 'host-choice';
            pointsToWin?: number;
            allowSpectators?: boolean;
            teamNames?: {
              0?: string;
              1?: string;
            };
          };
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          host_id?: string;
          status?: 'waiting' | 'ready' | 'playing' | 'finished' | 'abandoned';
          settings?: {
            maxPlayers?: number;
            isPrivate?: boolean;
            password?: string | null;
            teamAssignmentMethod?: 'random' | 'host-choice';
            pointsToWin?: number;
            allowSpectators?: boolean;
            teamNames?: {
              0?: string;
              1?: string;
            };
          };
          created_at?: string;
          updated_at?: string;
          last_activity_at?: string;
        };
      };
      room_players: {
        Row: {
          id: string;
          room_id: string;
          player_id: string;
          socket_id: string | null;
          name: string;
          team: number;
          is_ready: boolean;
          is_host: boolean;
          is_com: boolean;
          joined_at: string;
          seat_index: number;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id: string;
          socket_id?: string | null;
          name: string;
          team?: number;
          is_ready?: boolean;
          is_host?: boolean;
          is_com?: boolean;
          joined_at?: string;
          seat_index?: number;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string;
          socket_id?: string | null;
          name?: string;
          team?: number;
          is_ready?: boolean;
          is_host?: boolean;
          is_com?: boolean;
          joined_at?: string;
          seat_index?: number;
          user_id?: string | null;
        };
      };
      active_room_memberships: {
        Row: {
          user_id: string;
          room_id: string | null;
          player_id: string;
          status: 'moving' | 'active' | 'disconnected';
          membership_version: number;
          transition_id: string;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
        };
        Insert: {
          user_id: string;
          room_id?: string | null;
          player_id: string;
          status: 'moving' | 'active' | 'disconnected';
          membership_version?: number;
          transition_id: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Update: {
          user_id?: string;
          room_id?: string | null;
          player_id?: string;
          status?: 'moving' | 'active' | 'disconnected';
          membership_version?: number;
          transition_id?: string;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
      };
      room_membership_events: {
        Row: {
          id: number;
          transition_id: string;
          user_id: string;
          from_room_id: string | null;
          to_room_id: string | null;
          event_type: string;
          membership_version: number | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: number;
          transition_id: string;
          user_id: string;
          from_room_id?: string | null;
          to_room_id?: string | null;
          event_type: string;
          membership_version?: number | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: number;
          transition_id?: string;
          user_id?: string;
          from_room_id?: string | null;
          to_room_id?: string | null;
          event_type?: string;
          membership_version?: number | null;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
      game_states: {
        Row: {
          id: string;
          room_id: string;
          state_data: Record<string, any>;
          current_player_index: number;
          game_phase: 'deal' | 'blow' | 'play' | 'waiting' | null;
          round_number: number;
          points_to_win: number;
          team_scores: {
            [key: string]: { play: number; total: number };
          };
          team_score_records: {
            [key: string]: Array<{
              points: number;
              timestamp: string;
              reason: string;
            }>;
          };
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          state_data?: Record<string, any>;
          current_player_index?: number;
          game_phase?: 'deal' | 'blow' | 'play' | 'waiting' | null;
          round_number?: number;
          points_to_win?: number;
          team_scores?: {
            [key: string]: { play: number; total: number };
          };
          team_score_records?: {
            [key: string]: Array<{
              points: number;
              timestamp: string;
              reason: string;
            }>;
          };
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          state_data?: Record<string, any>;
          current_player_index?: number;
          game_phase?: 'deal' | 'blow' | 'play' | 'waiting' | null;
          round_number?: number;
          points_to_win?: number;
          team_scores?: {
            [key: string]: { play: number; total: number };
          };
          team_score_records?: {
            [key: string]: Array<{
              points: number;
              timestamp: string;
              reason: string;
            }>;
          };
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
          games_played: number;
          games_won: number;
          total_score: number;
          preferences: {
            notifications: boolean;
            sound: boolean;
            theme: 'light' | 'dark';
            fontSize: 'standard' | 'large' | 'xlarge' | 'xxlarge';
          };
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
          games_played?: number;
          games_won?: number;
          total_score?: number;
          preferences?: {
            notifications?: boolean;
            sound?: boolean;
            theme?: 'light' | 'dark';
            fontSize?: 'standard' | 'large' | 'xlarge' | 'xxlarge';
          };
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
          games_played?: number;
          games_won?: number;
          total_score?: number;
          preferences?: {
            notifications?: boolean;
            sound?: boolean;
            theme?: 'light' | 'dark';
            fontSize?: 'standard' | 'large' | 'xlarge' | 'xxlarge';
          };
        };
      };
      game_history: {
        Row: {
          id: string;
          room_id: string;
          game_state_id: string;
          action_type: string;
          player_id: string | null;
          action_data: Record<string, any>;
          timestamp: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          game_state_id: string;
          action_type: string;
          player_id?: string | null;
          action_data?: Record<string, any>;
          timestamp?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          game_state_id?: string;
          action_type?: string;
          player_id?: string | null;
          action_data?: Record<string, any>;
          timestamp?: string;
        };
      };
    };
  };
}
