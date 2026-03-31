/*
 * Copyright 2021-2025 mtripg6666tdr
 *
 * This file is part of mtripg6666tdr/Discord-SimpleMusicBot.
 * (npm package name: 'discord-music-bot' / repository url: <https://github.com/mtripg6666tdr/Discord-SimpleMusicBot> )
 *
 * mtripg6666tdr/Discord-SimpleMusicBot is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any later version.
 *
 * mtripg6666tdr/Discord-SimpleMusicBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with mtripg6666tdr/Discord-SimpleMusicBot.
 * If not, see <https://www.gnu.org/licenses/>.
 */

import type { PlaybackBackend, PlaybackPlayOptions, PlaybackTrackInfo } from ".";
import type { Client } from "oceanic.js";

import { Connectors, LoadType, Shoukaku } from "shoukaku";
import type { FilterOptions, NodeOption, Player, ShoukakuOptions } from "shoukaku";

import { getLogger } from "../../logger";

const logger = getLogger("LavalinkBackend");

interface GuildCallbacks {
  onTrackEnd: (() => void)[];
  onTrackError: ((error: Error) => void)[];
  onDisconnect: (() => void)[];
}

export class LavalinkBackend implements PlaybackBackend {
  readonly type = "lavalink" as const;
  readonly shoukaku: Shoukaku;
  private callbacks: Map<string, GuildCallbacks> = new Map();

  constructor(client: Client, nodes: NodeOption[], options?: ShoukakuOptions) {
    this.shoukaku = new Shoukaku(
      new Connectors.OceanicJS(client),
      nodes,
      {
        resume: true,
        resumeTimeout: 30,
        resumeByLibrary: true,
        reconnectTries: 5,
        reconnectInterval: 5000,
        moveOnDisconnect: true,
        ...options,
      },
    );

    // Register global accessor for strategies to use
    setShoukakuInstance(this.shoukaku);

    this.shoukaku.on("ready", (name) => {
      logger.info(`Lavalink node "${name}" connected`);
    });

    this.shoukaku.on("error", (name, error) => {
      logger.error(`Lavalink node "${name}" error:`, error);
    });

    this.shoukaku.on("close", (name, code, reason) => {
      logger.warn(`Lavalink node "${name}" closed: ${code} ${reason}`);
    });

    this.shoukaku.on("disconnect", (name, count) => {
      logger.warn(`Lavalink node "${name}" disconnected, ${count} players affected`);
    });

    this.shoukaku.on("debug", (name, info) => {
      logger.trace(`[Lavalink:${name}] ${info}`);
    });
  }

  async destroy(): Promise<void> {
    for (const [guildId] of this.shoukaku.players) {
      await this.disconnect(guildId).catch(logger.error);
    }
    for (const [name] of this.shoukaku.nodes) {
      this.shoukaku.removeNode(name);
    }
    setShoukakuInstance(null);
  }

  private getCallbacks(guildId: string): GuildCallbacks {
    let cb = this.callbacks.get(guildId);
    if (!cb) {
      cb = { onTrackEnd: [], onTrackError: [], onDisconnect: [] };
      this.callbacks.set(guildId, cb);
    }
    return cb;
  }

  private getPlayer(guildId: string): Player | undefined {
    return this.shoukaku.players.get(guildId);
  }

  private setupPlayerEvents(guildId: string, player: Player): void {
    player.on("end", (data) => {
      if (data.reason === "finished" || data.reason === "loadFailed") {
        const cb = this.getCallbacks(guildId);
        if (data.reason === "loadFailed") {
          cb.onTrackError.forEach(fn => fn(new Error(`Track load failed: ${data.track?.info?.title || "unknown"}`)));
        }
        cb.onTrackEnd.forEach(fn => fn());
      }
    });

    player.on("exception", (data) => {
      const cb = this.getCallbacks(guildId);
      cb.onTrackError.forEach(fn => fn(new Error(data.exception?.message || "Track exception")));
    });

    player.on("closed", (data) => {
      logger.warn(`WebSocket closed for guild ${guildId}: ${data.code} ${data.reason}`);
      if (data.byRemote) {
        const cb = this.getCallbacks(guildId);
        cb.onDisconnect.forEach(fn => fn());
      }
    });

    player.on("stuck", (data) => {
      logger.warn(`Track stuck for guild ${guildId}: threshold=${data.thresholdMs}ms`);
      const cb = this.getCallbacks(guildId);
      cb.onTrackError.forEach(fn => fn(new Error(`Track stuck (threshold: ${data.thresholdMs}ms)`)));
    });
  }

  async joinVoiceChannel(guildId: string, channelId: string, shardId: number, deaf = true): Promise<void> {
    const player = await this.shoukaku.joinVoiceChannel({
      guildId,
      channelId,
      shardId,
      deaf,
    });
    this.setupPlayerEvents(guildId, player);
    logger.info(`Joined voice channel ${channelId} in guild ${guildId}`);
  }

  async disconnect(guildId: string): Promise<void> {
    await this.shoukaku.leaveVoiceChannel(guildId);
    this.removeAllCallbacks(guildId);
    logger.info(`Disconnected from guild ${guildId}`);
  }

  isConnected(guildId: string): boolean {
    const player = this.getPlayer(guildId);
    return !!player;
  }

  async play(guildId: string, track: PlaybackTrackInfo, options?: PlaybackPlayOptions): Promise<void> {
    const player = this.getPlayer(guildId);
    if (!player) {
      throw new Error(`No Lavalink player for guild ${guildId}`);
    }

    const node = player.node;
    const identifier = track.identifier;

    // Try to resolve the track via Lavalink
    const result = await node.rest.resolve(identifier);
    if (!result) {
      throw new Error(`Lavalink could not resolve: ${identifier}`);
    }

    switch (result.loadType) {
      case LoadType.TRACK: {
        await player.playTrack({
          track: { encoded: result.data.encoded },
          ...(options?.seekSec ? { position: options.seekSec * 1000 } : {}),
          ...(options?.volume !== undefined ? { volume: options.volume } : {}),
        });
        break;
      }
      case LoadType.PLAYLIST: {
        // Play the first track of the playlist
        if (result.data.tracks.length > 0) {
          const selectedTrack = result.data.tracks[result.data.info.selectedTrack] || result.data.tracks[0];
          await player.playTrack({
            track: { encoded: selectedTrack.encoded },
            ...(options?.seekSec ? { position: options.seekSec * 1000 } : {}),
            ...(options?.volume !== undefined ? { volume: options.volume } : {}),
          });
        }
        break;
      }
      case LoadType.SEARCH: {
        if (result.data.length > 0) {
          await player.playTrack({
            track: { encoded: result.data[0].encoded },
            ...(options?.seekSec ? { position: options.seekSec * 1000 } : {}),
            ...(options?.volume !== undefined ? { volume: options.volume } : {}),
          });
        }
        break;
      }
      case LoadType.EMPTY:
        throw new Error(`No results for: ${identifier}`);
      case LoadType.ERROR:
        throw new Error(`Lavalink error: ${result.data.message}`);
    }
  }

  async stop(guildId: string): Promise<void> {
    const player = this.getPlayer(guildId);
    if (player) {
      await player.stopTrack();
    }
  }

  pause(guildId: string): void {
    const player = this.getPlayer(guildId);
    if (player) {
      player.setPaused(true).catch(logger.error);
    }
  }

  resume(guildId: string): void {
    const player = this.getPlayer(guildId);
    if (player) {
      player.setPaused(false).catch(logger.error);
    }
  }

  async seek(guildId: string, positionMs: number): Promise<void> {
    const player = this.getPlayer(guildId);
    if (player) {
      await player.seekTo(positionMs);
    }
  }

  isPlaying(guildId: string): boolean {
    const player = this.getPlayer(guildId);
    return !!player && !!player.track && !player.paused;
  }

  isPaused(guildId: string): boolean {
    const player = this.getPlayer(guildId);
    return !!player && !!player.track && player.paused;
  }

  currentTime(guildId: string): number {
    const player = this.getPlayer(guildId);
    return player?.position ?? 0;
  }

  setVolume(guildId: string, volume: number): boolean {
    const player = this.getPlayer(guildId);
    if (player) {
      // Shoukaku volume is 0-1000, our volume is 0-200
      // Map 100 -> 100 (normal), 200 -> 200 (max)
      player.setGlobalVolume(Math.round(volume * 10)).catch(logger.error);
      return true;
    }
    return false;
  }

  async setFilters(guildId: string, filters: FilterOptions): Promise<void> {
    const player = this.getPlayer(guildId);
    if (player) {
      await player.setFilters(filters);
    }
  }

  onTrackEnd(guildId: string, callback: () => void): void {
    this.getCallbacks(guildId).onTrackEnd.push(callback);
  }

  onTrackError(guildId: string, callback: (error: Error) => void): void {
    this.getCallbacks(guildId).onTrackError.push(callback);
  }

  onDisconnect(guildId: string, callback: () => void): void {
    this.getCallbacks(guildId).onDisconnect.push(callback);
  }

  removeAllCallbacks(guildId: string): void {
    this.callbacks.delete(guildId);
  }
}

// Global accessor for Lavalink Shoukaku instance (used by Lavalink strategy)
let _globalShoukaku: Shoukaku | null = null;

export function getShoukakuInstance(): Shoukaku | null {
  return _globalShoukaku;
}

export function setShoukakuInstance(shoukaku: Shoukaku | null): void {
  _globalShoukaku = shoukaku;
}
