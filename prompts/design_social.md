# Meitra Social Layer Design

## Context & Intent
- Bridge Base Online (BBO) demonstrates that an always-on lobby, a persistent friend graph, and rich spectating loops are core to long-term engagement.
- Meitra already ships with Supabase Auth, matchmaking, and real-time gameplay; the social layer must slot into the existing Next.js / NestJS / Supabase stack without breaking current flows.
- We follow Clean Architecture ideals—domain models and application use-cases live in `shared/`, `mei-tra-backend/src/social/` contains adapters, and UI orchestration stays inside the frontend. This keeps the social layer evolvable on web and future mobile clients.

## Guiding Principles
- **Dependency rule first**: domain entities (`shared/domain/social/*.ts`) own business rules; backend services adapt them via repositories, and frontends consume DTOs mapped from domain objects.
- **Presence everywhere**: surface who is online and what they are doing across lobby, tables, and profile views.
- **Rooms before DMs**: prioritise lobby & table conversations to create shared spaces before deep one-to-one messaging.
- **Moderation by default**: blocklists, mute scopes, and report pipelines exist alongside every communication surface.
- **Cross-client parity**: REST endpoints expose use-cases; Socket.IO events keep clients reactive. Contracts sit in `shared/contracts/social.ts` to ensure symmetry.

## Delivery Phasing
1. **Phase 1 – Chat & Friends Use-Cases**
   - Implement domain use-cases (`AddFriend`, `AcceptFriend`, `PostChatMessage`) and map to Nest controllers/gateways.
   - Global + table chat via `/social` namespace.
   - Presence badges rendered via domain `PresenceSnapshot` entity.
   - Toast notifications for friend requests and chat mentions.
2. **Phase 2 – Lobby Presence & Spectating**
   - Aggregate lobby roster use-case (`ListActiveTables`) returning DTOs for the lobby directory.
   - Observer channels with read-only chat publishing domain events.
   - Activity feed panel backed by `ListNotifications` use-case.
3. **Phase 3 – Replays & Leaderboards**
   - Replay capture pipeline triggered by gameplay bounded context -> `RecordReplay` use-case storing domain `Replay` aggregate.
   - Weekly / seasonal leaderboard snapshots generated via Supabase function invoked by Nest scheduled job.
4. **Phase 4 – Advanced Moderation & Mobile Polish**
   - Moderation review workflows, temporary mute policies, and audit logs.
   - Push notification abstraction for mobile/desktop parity.

Each phase hands off clear contracts to frontend teams while keeping domain logic centralised.

---

## Architecture Overview
- **Domain Layer (`shared/domain/social/`)**
  - Entities: `Profile`, `Friendship`, `ChatMessage`, `Presence`, `Replay`, `LeaderboardSnapshot`, `Notification`, `ModerationAction`.
  - Value Objects: `UserId`, `ChatRoomId`, `Visibility`, `RankTier`.
  - Use-Cases: functions returning `Result` objects, independent of Nest/Next.
- **Application Layer (Backend)**
  - `mei-tra-backend/src/social/application/` exposes services orchestrating domain use-cases and calling repositories.
  - `repositories/` implement interfaces (`ProfileRepository`, `ChatRoomRepository`, etc.) using Supabase SDK.
  - `SocialModule` wires controllers (`ProfilesController`, `FriendsController`, `ChatController`, `NotificationsController`) and gateway (`SocialGateway`).
- **Interface Layer (Frontend)**
  - Next.js server actions / API routes fetch via REST; client components subscribe through a shared `useSocialSocket` hook.
  - UI state hooks mirror domain models via TypeScript adapters in `mei-tra-frontend/lib/social/mapper.ts`.
- **Infrastructure**
  - Supabase Postgres handles persistence with RLS per table.
  - Socket.IO for realtime events (namespace `/social`).
  - Optional Redis adapter behind `PresenceCache` interface for production; fallback to in-memory for local dev.

---

## Database Schema
- `profiles (user_id PK/FK auth.users, display_name, avatar_url, bio, country_code, rank_tier, rank_points, last_online_at, reputation_score)`
- `friends (id PK, requester_id FK, addressee_id FK, status enum[pending, accepted, blocked], created_at)`
- `blocks (id PK, user_id FK, target_id FK, reason text, created_at)`
- `presence_sessions (id PK, user_id FK, device_type enum, status enum[online, idle, playing], table_id nullable, last_seen_at)`
- `chat_rooms (id PK, scope enum[global, lobby, table, private], name, owner_id nullable, visibility enum[public, friends, private])`
- `chat_members (id PK, room_id FK, user_id FK, role enum[member, moderator], joined_at)`
- `chat_messages (id PK, room_id FK, sender_id FK, content text, content_type enum[text, emoji, system], created_at, reply_to nullable)`
- `match_replays (id PK, table_id, owner_id FK, visibility enum[public, friends, private], payload jsonb, created_at)`
- `replay_views (id PK, replay_id FK, viewer_id FK nullable, favorited boolean, created_at)`
- `leaderboard_snapshots (id PK, period enum[weekly, season, all_time], starts_at, ends_at, data jsonb, created_at)`
- `notifications (id PK, user_id FK, type enum[friend_request, invite, chat_mention, system], payload jsonb, read_at nullable, created_at)`
- `reports (id PK, reporter_id FK, target_id FK, category enum[chat, gameplay, name], description text, evidence jsonb, status enum[open, reviewing, resolved], created_at)`
- `mutes (id PK, user_id FK, target_id FK, scope enum[global, table, room], expires_at nullable, created_at)`
- `table_spectators (id PK, table_id FK, user_id FK nullable, seat enum[observer, vugraph], joined_at)`

Each table has RLS policies referencing Supabase Auth UID. Repositories translate between raw rows and domain entities.

---

## API Design
- **Profiles**
  - `GET /profiles/:id` → maps to `FindProfile` use-case.
  - `PATCH /profiles/:id` → `UpdateProfile` use-case, guard ensures `user_id` matches token.
  - `GET /profiles/:id/stats` → Supabase RPC, mapped into `ProfileStatsDTO`.
- **Friends & Blocks**
  - `POST /friends {targetId}` → `RequestFriendship` use-case.
  - `PATCH /friends/:id {status}` → `RespondFriendship` use-case.
  - `DELETE /friends/:id` → `RemoveFriendship` use-case.
  - `POST /blocks`, `DELETE /blocks/:id` → `ToggleBlock` use-case.
- **Presence**
  - `GET /presence?since=` → `ListPresence` use-case returning aggregated snapshot for friends + lobby.
- **Chat**
  - `GET /chat/rooms?scope=` → `ListChatRooms` use-case (filters by visibility + membership).
  - `POST /chat/rooms {scope,name,visibility}` → `CreateChatRoom` use-case (requires ownership guard for private rooms).
  - `GET /chat/rooms/:id/messages?cursor=` → `ListChatMessages` use-case (cursor pagination).
  - `POST /chat/rooms/:id/messages {content}` → `PostChatMessage` use-case.
  - `POST /chat/rooms/:id/typing` → writes ephemeral entry to `PresenceCache`.
- **Replays**
  - `POST /replays` (internal hook from gameplay service) → `RecordReplay` use-case.
  - `GET /replays?visibility=` → `ListReplays` use-case.
  - `GET /replays/:id` → `FetchReplay` use-case.
  - `POST /replays/:id/favorite` → `ToggleReplayFavorite` use-case.
- **Leaderboards**
  - `GET /leaderboards?period=` → `GetLeaderboardSnapshot` use-case reading cached jsonb.
  - `POST /leaderboards/refresh` (cron) → `GenerateLeaderboardSnapshot` use-case + Supabase RPC.
- **Notifications & Moderation**
  - `GET /notifications?cursor=` → `ListNotifications` use-case.
  - `POST /notifications/read-batch` → `MarkNotificationsRead` use-case.
  - `POST /reports`, `GET /reports/:id` (moderator) → `SubmitReport`, `GetReport` use-cases.
  - `POST /mutes` → `MuteUser` use-case.

Controllers receive DTOs, resolve use-case providers, and convert `Result` objects into HTTP responses.

---

## Event Contracts
```ts
// shared/contracts/social.ts
export interface PresenceEvent {
  type: 'presence.update';
  userId: string;
  status: 'online' | 'idle' | 'playing';
  tableId?: string;
  lastSeenAt: string;
}

export interface FriendEvent {
  type: 'friend.request' | 'friend.status';
  requestId: string;
  fromUser: BasicProfile;
  status?: 'accepted' | 'rejected';
  createdAt: string;
}

export interface ChatMessageEvent {
  type: 'chat.message';
  roomId: string;
  message: ChatMessage;
}

export interface ChatTypingEvent {
  type: 'chat.typing';
  roomId: string;
  userId: string;
  startedAt: string;
}

export interface ReplayPublishedEvent {
  type: 'replay.published';
  replayId: string;
  tableId: string;
  visibility: 'public' | 'friends' | 'private';
  createdAt: string;
}

export interface LeaderboardUpdatedEvent {
  type: 'leaderboard.updated';
  period: 'weekly' | 'season' | 'all_time';
  snapshotId: string;
  generatedAt: string;
}

export interface NotificationEvent {
  type: 'notification.push';
  notification: NotificationPayload;
}

export interface BasicProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  countryCode?: string;
  rankTier: string;
}

export interface ChatMessage {
  id: string;
  sender: BasicProfile;
  content: string;
  contentType: 'text' | 'emoji' | 'system';
  createdAt: string;
  replyTo?: string;
}
```

Domain events (`FriendshipRequested`, `ChatMessagePosted`, etc.) raise these socket contracts via adapter classes so the dependency rule remains intact.

---

## UI Component Proposal
- `components/social/FriendsSidebar.tsx` – subscribes to `presence.update`, renders domain `FriendSummary` objects, exposes invite CTA.
- `components/social/ProfileCard.tsx` + `ProfileEditorModal.tsx` – map domain `Profile` to UI, provide edit form using server actions.
- `components/chat/ChatDock.tsx` – tabbed chat (Global, Lobby, Table, Private) with message stream, composer, and inline moderation actions.
- `components/social/LobbyDirectory.tsx` – renders `ActiveTableViewModel` list, supports filter chips (Friends Playing, Spectatable, Tournaments).
- `components/replay/ReplayGallery.tsx` + `ReplayViewer.tsx` – browse `ReplayPreview` DTOs, view timeline, leave reactions tied to chat channel.
- `components/leaderboard/LeaderboardPanel.tsx` – toggle weekly/all-time data, display delta arrows from previous snapshot.
- `components/notifications/NotificationBell.tsx` + `NotificationList.tsx` – uses `NotificationEvent` to update cache; supports bulk read.
- `components/social/ModerationActions.tsx` – wraps `Report`/`Mute` flows, reuses `ReportReasonSelect` value object.

Adapters ensure UI components only depend on view models, not raw database rows.

---

## Implementation Roadmap (12 Weeks)
- **Weeks 1-3 (Phase 1)**: establish domain packages, implement friend & chat use-cases, RLS policies, Socket.IO gateway. Validate with `npm run lint`, backend `npm test`, and `supabase db reset`.
- **Weeks 4-6 (Phase 2)**: lobby directory & spectating flows, presence cache abstraction, notification feed UI. Instrument metrics.
- **Weeks 7-9 (Phase 3)**: replay pipeline (Edge function + storage), leaderboard snapshot job, frontend gallery.
- **Weeks 10-12 (Phase 4)**: moderation dashboards, mute expiry jobs, push-ready notification abstraction, responsive/mobile polish.

Each milestone concludes with code review referencing use-case interfaces and ensuring dependency direction (domain ← application ← interface) remains intact.
