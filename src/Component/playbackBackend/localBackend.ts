import type { PlaybackBackend, PlaybackPlayOptions, PlaybackTrackInfo } from ".";
import type { FilterOptions } from "shoukaku";

/**
 * Local playback backend stub.
 * The actual local playback logic remains in PlayManager.
 * This backend is a marker to indicate that local @discordjs/voice playback should be used.
 */
export class LocalBackend implements PlaybackBackend {
  readonly type = "local" as const;

  async destroy(): Promise<void> {
    // no-op for local backend
  }

  async joinVoiceChannel(_guildId: string, _channelId: string, _shardId: number, _deaf?: boolean): Promise<void> {
    throw new Error("Local backend voice connection is managed by GuildDataContainer");
  }

  async disconnect(_guildId: string): Promise<void> {
    throw new Error("Local backend disconnect is managed by PlayManager");
  }

  isConnected(_guildId: string): boolean {
    throw new Error("Local backend state is managed by PlayManager");
  }

  async play(_guildId: string, _track: PlaybackTrackInfo, _options?: PlaybackPlayOptions): Promise<void> {
    throw new Error("Local backend playback is managed by PlayManager");
  }

  async stop(_guildId: string, _force?: boolean): Promise<void> {
    throw new Error("Local backend stop is managed by PlayManager");
  }

  pause(_guildId: string): void {
    throw new Error("Local backend pause is managed by PlayManager");
  }

  resume(_guildId: string): void {
    throw new Error("Local backend resume is managed by PlayManager");
  }

  async seek(_guildId: string, _positionMs: number): Promise<void> {
    throw new Error("Local backend seek is managed by PlayManager");
  }

  isPlaying(_guildId: string): boolean {
    throw new Error("Local backend state is managed by PlayManager");
  }

  isPaused(_guildId: string): boolean {
    throw new Error("Local backend state is managed by PlayManager");
  }

  currentTime(_guildId: string): number {
    throw new Error("Local backend state is managed by PlayManager");
  }

  setVolume(_guildId: string, _volume: number): boolean {
    throw new Error("Local backend volume is managed by PlayManager");
  }

  async setFilters(_guildId: string, _filters: FilterOptions): Promise<void> {
    throw new Error("Local backend filters are managed via FFmpeg in PlayManager");
  }

  onTrackEnd(_guildId: string, _callback: () => void): void {
    // no-op: local backend events are managed by PlayManager's AudioPlayer listeners
  }

  onTrackError(_guildId: string, _callback: (error: Error) => void): void {
    // no-op
  }

  onDisconnect(_guildId: string, _callback: () => void): void {
    // no-op
  }

  removeAllCallbacks(_guildId: string): void {
    // no-op
  }
}
