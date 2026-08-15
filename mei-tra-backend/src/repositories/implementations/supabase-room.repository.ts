/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IRoomRepository } from '../interfaces/room.repository.interface';
import { Room, RoomStatus, RoomPlayer } from '../../types/room.types';
import { Database } from '../../types/database.types';
import { asSeatId, resolveSeatId } from '../../types/identity.types';

type RoomRow = Database['public']['Tables']['rooms']['Row'];
type RoomUpdate = Database['public']['Tables']['rooms']['Update'];
type RoomPlayerRow = Database['public']['Tables']['room_players']['Row'];

interface CreatedRoomWithHostSeat {
  room: RoomRow;
  roomPlayer: RoomPlayerRow;
}

@Injectable()
export class SupabaseRoomRepository implements IRoomRepository {
  private readonly logger = new Logger(SupabaseRoomRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    // Return typed client, but cast for database operations due to strict typing issues
    return this.supabaseService.client as any;
  }

  async createWithHostSeat(
    room: Room,
    hostPlayer: RoomPlayer,
    transitionId: string,
  ): Promise<Room> {
    const hostSeatId = resolveSeatId(hostPlayer);
    const hostUserId = hostPlayer.userId;
    if (!hostUserId) {
      throw new Error('Authenticated host user is required');
    }

    const { data, error } = await this.supabase.rpc(
      'create_room_with_host_seat_atomic',
      {
        p_room_id: room.id,
        p_room_name: room.name,
        p_host_seat_id: hostSeatId,
        p_host_user_id: hostUserId,
        p_host_name: hostPlayer.name,
        p_room_settings: room.settings,
        p_points_to_win: room.settings.pointsToWin,
        p_transition_id: transitionId,
      },
    );

    if (error) {
      this.logger.error('Failed to create room with host seat:', error);
      throw new Error(`Failed to create room with host seat: ${error.message}`);
    }

    const created = data as CreatedRoomWithHostSeat;
    return this.mapDatabaseToRoom(created.room, [
      this.mapDatabaseToPlayer(created.roomPlayer),
    ]);
  }

  async findById(roomId: string): Promise<Room | null> {
    try {
      const { data: roomData, error: roomError } = await this.supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) {
        if (roomError.code === 'PGRST116') {
          return null; // Room not found
        }
        throw new Error(`Failed to fetch room: ${roomError.message}`);
      }

      const playersByRoomId = await this.fetchPlayersByRoomIds([roomId]);
      const players = playersByRoomId.get(roomId) ?? [];
      return this.mapDatabaseToRoom(roomData, players);
    } catch (error) {
      this.logger.error('Error finding room by ID:', error);
      throw error;
    }
  }

  async update(roomId: string, updates: Partial<Room>): Promise<Room | null> {
    try {
      const updateData: Partial<RoomUpdate> = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.hostSeatId) {
        updateData.host_seat_id = updates.hostSeatId;
      }
      if (updates.status) updateData.status = updates.status;
      if (updates.settings) updateData.settings = updates.settings;
      if (updates.lastActivityAt)
        updateData.last_activity_at = updates.lastActivityAt.toISOString();

      const { data, error } = await this.supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update room: ${error.message}`);
      }

      const playersByRoomId = await this.fetchPlayersByRoomIds([roomId]);
      const players = playersByRoomId.get(roomId) ?? [];
      return this.mapDatabaseToRoom(data, players);
    } catch (error) {
      this.logger.error('Error updating room:', error);
      throw error;
    }
  }

  async delete(roomId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

      if (error) {
        throw new Error(`Failed to delete room: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Error deleting room:', error);
      throw error;
    }
  }

  async findAll(): Promise<Room[]> {
    try {
      const { data: roomsData, error: roomsError } = await this.supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });

      if (roomsError) {
        throw new Error(`Failed to fetch rooms: ${roomsError.message}`);
      }

      return this.mapRoomsWithPlayers(roomsData);
    } catch (error) {
      this.logger.error('Error finding all rooms:', error);
      throw error;
    }
  }

  async findByStatus(status: RoomStatus): Promise<Room[]> {
    try {
      const { data: roomsData, error } = await this.supabase
        .from('rooms')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch rooms by status: ${error.message}`);
      }

      return this.mapRoomsWithPlayers(roomsData);
    } catch (error) {
      this.logger.error('Error finding rooms by status:', error);
      throw error;
    }
  }

  async findByHostId(hostId: string): Promise<Room[]> {
    try {
      const { data: roomsData, error } = await this.supabase
        .from('rooms')
        .select('*')
        .eq('host_seat_id', hostId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch rooms by host: ${error.message}`);
      }

      return this.mapRoomsWithPlayers(roomsData);
    } catch (error) {
      this.logger.error('Error finding rooms by host ID:', error);
      throw error;
    }
  }

  async findRecentFinishedByUserId(
    userId: string,
    limit: number,
  ): Promise<Room[]> {
    try {
      const { data: roomsData, error } = await this.supabase
        .from('rooms')
        .select('*, room_players!room_players_room_id_fkey!inner(user_id)')
        .eq('status', RoomStatus.FINISHED)
        .eq('room_players.user_id', userId)
        .order('last_activity_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(
          `Failed to fetch recent finished rooms by user: ${error.message}`,
        );
      }

      return this.mapRoomsWithPlayers((roomsData ?? []) as RoomRow[]);
    } catch (error) {
      this.logger.error(
        'Error finding recent finished rooms by user ID:',
        error,
      );
      throw error;
    }
  }

  async updateStatus(roomId: string, status: RoomStatus): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('rooms')
        .update({ status })
        .eq('id', roomId);

      if (error) {
        this.logger.error('Failed to update room status:', error);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error updating room status:', error);
      return false;
    }
  }

  async updateLastActivity(roomId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('rooms')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', roomId);

      if (error) {
        throw new Error(`Failed to update last activity: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Error updating last activity:', error);
      throw error;
    }
  }

  async deleteExpiredRooms(expiryTime: number): Promise<number> {
    try {
      const expiryDate = new Date(Date.now() - expiryTime);

      const { data, error } = await this.supabase
        .from('rooms')
        .delete()
        .lt('last_activity_at', expiryDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to delete expired rooms: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      this.logger.error('Error deleting expired rooms:', error);
      throw error;
    }
  }

  async findRoomsOlderThan(timestamp: Date): Promise<Room[]> {
    try {
      const { data: roomsData, error } = await this.supabase
        .from('rooms')
        .select('*')
        .lt('last_activity_at', timestamp.toISOString());

      if (error) {
        throw new Error(`Failed to find old rooms: ${error.message}`);
      }

      return this.mapRoomsWithPlayers(roomsData);
    } catch (error) {
      this.logger.error('Error finding old rooms:', error);
      throw error;
    }
  }

  private mapDatabaseToRoom(dbRoom: RoomRow, players: RoomPlayer[]): Room {
    const hostSeatId = dbRoom.host_seat_id ?? players[0]?.playerId;
    if (!hostSeatId) {
      throw new Error(`Room ${dbRoom.id} has no canonical host seat`);
    }
    const canonicalPlayers = players.map((player) => ({
      ...player,
      isHost: player.playerId === hostSeatId,
    }));
    return {
      id: dbRoom.id,
      name: dbRoom.name,
      hostSeatId: asSeatId(hostSeatId),
      status: dbRoom.status as RoomStatus,
      players: canonicalPlayers,
      settings: dbRoom.settings,
      createdAt: new Date(dbRoom.created_at),
      updatedAt: new Date(dbRoom.updated_at),
      lastActivityAt: new Date(dbRoom.last_activity_at),
    };
  }

  private async mapRoomsWithPlayers(roomsData: RoomRow[]): Promise<Room[]> {
    const playersByRoomId = await this.fetchPlayersByRoomIds(
      roomsData.map((room) => room.id),
    );

    return roomsData.map((roomData) =>
      this.mapDatabaseToRoom(roomData, playersByRoomId.get(roomData.id) ?? []),
    );
  }

  private async fetchPlayersByRoomIds(
    roomIds: string[],
  ): Promise<Map<string, RoomPlayer[]>> {
    const playersByRoomId = new Map<string, RoomPlayer[]>();

    for (const roomId of roomIds) {
      playersByRoomId.set(roomId, []);
    }

    if (roomIds.length === 0) {
      return playersByRoomId;
    }

    const { data: playersData, error } = await this.supabase
      .from('room_players')
      .select('*')
      .in('room_id', roomIds)
      .order('room_id', { ascending: true })
      .order('seat_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch room players: ${error.message}`);
    }

    for (const dbPlayer of playersData ?? []) {
      const players = playersByRoomId.get(dbPlayer.room_id);
      if (players) {
        players.push(this.mapDatabaseToPlayer(dbPlayer));
      }
    }

    return playersByRoomId;
  }

  private mapDatabaseToPlayer(dbPlayer: RoomPlayerRow): RoomPlayer {
    const seatId = asSeatId(dbPlayer.id);
    return {
      socketId: '',
      seatId,
      playerId: seatId,
      participantKey: dbPlayer.user_id ?? dbPlayer.id,
      userId: dbPlayer.user_id ?? undefined,
      isAuthenticated: Boolean(dbPlayer.user_id),
      name: dbPlayer.name,
      hand: [],
      team: dbPlayer.team as 0 | 1,
      isPasser: false,
      hasBroken: false,
      hasRequiredBroken: false,
      isReady: dbPlayer.is_ready,
      isHost: false,
      isCOM: dbPlayer.is_com,
      joinedAt: new Date(dbPlayer.joined_at),
      seatIndex: dbPlayer.seat_index,
    };
  }
}
