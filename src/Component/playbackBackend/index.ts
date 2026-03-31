import type { Readable } from "stream";

import type { FilterOptions } from "shoukaku";

export type StreamTypeIdentifier = "webm/opus" | "ogg/opus" | "mp3" | "mp4" | "raw" | "m3u8" | "unknown" | "opus";

export interface StreamInfo {
  type: "readable";
  stream: Readable;
  streamType: StreamTypeIdentifier;
}

export interface UrlStreamInfo {
  type: "url";
  url: string;
  streamType: StreamTypeIdentifier;
  userAgent?: string;
}

export type AnyStreamInfo = StreamInfo | UrlStreamInfo;

export interface PlaybackTrackInfo {
  /** URL or identifier for Lavalink to resolve */
  identifier: string;
  /** Stream info for local playback */
  streamInfo?: AnyStreamInfo;
  /** Track duration in seconds */
  lengthSeconds: number;
  /** Track title */
  title: string;
  /** Whether the track is a live stream */
  isLive: boolean;
}

export interface PlaybackPlayOptions {
  /** Seek position in seconds */
  seekSec?: number;
  /** Volume (0-200) */
  volume?: number;
}

export interface PlaybackBackend {
  readonly type: "local" | "lavalink";

  // Lifecycle
  destroy(): Promise<void>;

  // Connection
  joinVoiceChannel(guildId: string, channelId: string, shardId: number, deaf?: boolean): Promise<void>;
  disconnect(guildId: string): Promise<void>;
  isConnected(guildId: string): boolean;

  // Playback
  play(guildId: string, track: PlaybackTrackInfo, options?: PlaybackPlayOptions): Promise<void>;
  stop(guildId: string, force?: boolean): Promise<void>;
  pause(guildId: string): void;
  resume(guildId: string): void;
  seek(guildId: string, positionMs: number): Promise<void>;

  // State
  isPlaying(guildId: string): boolean;
  isPaused(guildId: string): boolean;
  /** Returns current playback position in milliseconds */
  currentTime(guildId: string): number;

  // Audio
  setVolume(guildId: string, volume: number): boolean;
  setFilters(guildId: string, filters: FilterOptions): Promise<void>;

  // Events
  onTrackEnd(guildId: string, callback: () => void): void;
  onTrackError(guildId: string, callback: (error: Error) => void): void;
  onDisconnect(guildId: string, callback: () => void): void;
  removeAllCallbacks(guildId: string): void;
}
