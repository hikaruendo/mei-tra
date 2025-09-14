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
          hand: string[];
          team: number;
          is_passer: boolean;
          has_broken: boolean;
          has_required_broken: boolean;
          is_ready: boolean;
          is_host: boolean;
          joined_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id: string;
          socket_id?: string | null;
          name: string;
          hand?: string[];
          team?: number;
          is_passer?: boolean;
          has_broken?: boolean;
          has_required_broken?: boolean;
          is_ready?: boolean;
          is_host?: boolean;
          joined_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string;
          socket_id?: string | null;
          name?: string;
          hand?: string[];
          team?: number;
          is_passer?: boolean;
          has_broken?: boolean;
          has_required_broken?: boolean;
          is_ready?: boolean;
          is_host?: boolean;
          joined_at?: string;
          user_id?: string | null;
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
          team_assignments: { [key: string]: number };
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
          team_assignments?: { [key: string]: number };
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
          team_assignments?: { [key: string]: number };
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
