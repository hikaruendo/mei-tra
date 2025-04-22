import { Injectable } from '@nestjs/common';
import { Room, RoomRepository } from '../types/room.types';

@Injectable()
export class RoomService implements RoomRepository {
  private rooms: Map<string, Room> = new Map();

  createRoom(room: Room): Promise<Room> {
    this.rooms.set(room.id, room);
    return Promise.resolve(room);
  }

  getRoom(roomId: string): Promise<Room | null> {
    return Promise.resolve(this.rooms.get(roomId) || null);
  }

  updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | null> {
    const room = this.rooms.get(roomId);
    if (!room) return Promise.resolve(null);

    const updatedRoom = { ...room, ...updates };
    this.rooms.set(roomId, updatedRoom);
    return Promise.resolve(updatedRoom);
  }

  deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    return Promise.resolve();
  }

  listRooms(): Promise<Room[]> {
    return Promise.resolve(Array.from(this.rooms.values()));
  }

  async createNewRoom(name: string, hostId: string): Promise<Room> {
    const room: Room = {
      id: this.generateRoomId(),
      name,
      hostId,
      status: 'waiting',
      players: [hostId],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.createRoom(room);
  }

  async joinRoom(roomId: string, playerId: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room || room.players.length >= room.settings.maxPlayers) {
      return false;
    }

    // Check if player already exists in the room
    if (room.players.includes(playerId)) {
      return false; // or return true if rejoining is allowed
    }

    // Add player to the room
    room.players.push(playerId);
    room.updatedAt = new Date();
    await this.updateRoom(roomId, room);
    return true;
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
