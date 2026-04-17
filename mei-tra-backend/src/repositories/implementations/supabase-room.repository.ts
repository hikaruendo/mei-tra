/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { IRoomRepository } from '../interfaces/room.repository.interface';
import { Room, RoomStatus, RoomPlayer } from '../../types/room.types';
import { Database } from '../../types/database.types';

type RoomRow = Database['public']['Tables']['rooms']['Row'];
type RoomUpdate = Database['public']['Tables']['rooms']['Update'];
type RoomPlayerRow = Database['public']['Tables']['room_players']['Row'];
type RoomPlayerUpdate = Database['public']['Tables']['room_players']['Update'];

@Injectable()
export class SupabaseRoomRepository implements IRoomRepository {
  private readonly logger = new Logger(SupabaseRoomRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    // Return typed client, but cast for database operations due to strict typing issues
    return this.supabaseService.client as any;
  }

  async create(room: Room): Promise<Room> {
    try {
      const { data, error } = await this.supabase
        .from('rooms')
        .insert({
          // idはDEFAULT値でUUID自動生成されるため除外
          name: room.name,
          host_id: room.hostId,
          status: room.status,
          settings: room.settings,
          created_at: room.createdAt.toISOString(),
          updated_at: room.updatedAt.toISOString(),
          last_activity_at: room.lastActivityAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to create room:', error);
        throw new Error(`Failed to create room: ${error.message}`);
      }

      // Create room players
      if (room.players.length > 0) {
        await this.addMultiplePlayers(room.id, room.players);
      }

      return this.mapDatabaseToRoom(data, room.players);
    } catch (error) {
      this.logger.error('Error creating room:', error);
      throw error;
    }
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
      if (updates.hostId) updateData.host_id = updates.hostId;
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
        .eq('host_id', hostId)
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
        .select('*, room_players!inner(user_id)')
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

  async addPlayer(roomId: string, player: RoomPlayer): Promise<boolean> {
    try {
      // Check if player already exists
      const { data: existingPlayer } = await this.supabase
        .from('room_players')
        .select('player_id')
        .eq('room_id', roomId)
        .eq('player_id', player.playerId)
        .single();

      if (existingPlayer) {
        this.logger.warn(
          `Player ${player.playerId} already exists in room ${roomId}`,
        );
        return true; // Player already exists, consider it success
      }

      const { error } = await this.supabase.from('room_players').insert({
        room_id: roomId,
        player_id: player.playerId,
        socket_id: player.socketId,
        user_id: player.userId ?? null,
        name: player.name,
        hand: player.hand,
        team: player.team,
        is_passer: player.isPasser,
        has_broken: player.hasBroken,
        has_required_broken: player.hasRequiredBroken,
        is_ready: player.isReady,
        is_host: player.isHost,
        is_com: player.isCOM ?? false,
        joined_at: player.joinedAt.toISOString(),
      });

      if (error) {
        this.logger.error('Failed to add player:', error);
        return false;
      }

      await this.updateLastActivity(roomId);
      return true;
    } catch (error) {
      this.logger.error('Error adding player:', error);
      return false;
    }
  }

  async removePlayer(roomId: string, playerId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('room_players')
        .delete()
        .eq('room_id', roomId)
        .eq('player_id', playerId);

      if (error) {
        this.logger.error('Failed to remove player:', error);
        return false;
      }

      await this.updateLastActivity(roomId);
      return true;
    } catch (error) {
      this.logger.error('Error removing player:', error);
      return false;
    }
  }

  async updatePlayer(
    roomId: string,
    playerId: string,
    updates: Partial<RoomPlayer>,
  ): Promise<boolean> {
    try {
      const updateData: Partial<RoomPlayerUpdate> = {};

      if (updates.socketId !== undefined) {
        updateData.socket_id = updates.socketId;
      }
      if (updates.userId !== undefined) updateData.user_id = updates.userId;
      if (updates.name) updateData.name = updates.name;
      if (updates.hand) updateData.hand = updates.hand;
      if (updates.team !== undefined) updateData.team = updates.team;
      if (updates.isPasser !== undefined)
        updateData.is_passer = updates.isPasser;
      if (updates.hasBroken !== undefined)
        updateData.has_broken = updates.hasBroken;
      if (updates.hasRequiredBroken !== undefined)
        updateData.has_required_broken = updates.hasRequiredBroken;
      if (updates.isReady !== undefined) updateData.is_ready = updates.isReady;
      if (updates.isHost !== undefined) updateData.is_host = updates.isHost;

      const { error } = await this.supabase
        .from('room_players')
        .update(updateData)
        .eq('room_id', roomId)
        .eq('player_id', playerId);

      if (error) {
        this.logger.error('Failed to update player:', error);
        return false;
      }

      await this.updateLastActivity(roomId);
      return true;
    } catch (error) {
      this.logger.error('Error updating player:', error);
      return false;
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

  private async addMultiplePlayers(
    roomId: string,
    players: RoomPlayer[],
  ): Promise<void> {
    const playerInserts = players.map((player) => ({
      room_id: roomId,
      player_id: player.playerId,
      socket_id: player.socketId,
      user_id: player.userId ?? null,
      name: player.name,
      hand: player.hand,
      team: player.team,
      is_passer: player.isPasser,
      has_broken: player.hasBroken,
      has_required_broken: player.hasRequiredBroken,
      is_ready: player.isReady,
      is_host: player.isHost,
      is_com: player.isCOM ?? false,
      joined_at: player.joinedAt.toISOString(),
    }));

    const { error } = await this.supabase
      .from('room_players')
      .insert(playerInserts);

    if (error) {
      throw new Error(`Failed to add players: ${error.message}`);
    }
  }

  private mapDatabaseToRoom(dbRoom: RoomRow, players: RoomPlayer[]): Room {
    return {
      id: dbRoom.id,
      name: dbRoom.name,
      hostId: dbRoom.host_id,
      status: dbRoom.status as RoomStatus,
      players,
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
      .order('joined_at', { ascending: true });

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
    return {
      socketId: dbPlayer.socket_id || '',
      playerId: dbPlayer.player_id,
      userId: dbPlayer.user_id ?? undefined,
      name: dbPlayer.name,
      hand: dbPlayer.hand,
      team: dbPlayer.team as 0 | 1,
      isPasser: dbPlayer.is_passer,
      hasBroken: dbPlayer.has_broken,
      hasRequiredBroken: dbPlayer.has_required_broken,
      isReady: dbPlayer.is_ready,
      isHost: dbPlayer.is_host,
      isCOM: dbPlayer.player_id.startsWith('com-'),
      joinedAt: new Date(dbPlayer.joined_at),
    };
  }
}
