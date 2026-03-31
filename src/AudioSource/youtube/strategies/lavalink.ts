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

import type { YouTubeJsonFormat } from "..";
import type { StreamInfo, UrlStreamInfo } from "../../audiosource";
import type { StrategyFetchResult } from "./base";

import { LoadType } from "shoukaku";
import type { Track } from "shoukaku";

import { Strategy, type Cache } from "./base";
import { getShoukakuInstance } from "../../../Component/playbackBackend/lavalinkBackend";

type LavalinkCacheType = "lavalink";
const LAVALINK_CACHE_TYPE: LavalinkCacheType = "lavalink";

interface LavalinkCacheData {
  track: Track;
}

type LavalinkCache = Cache<LavalinkCacheType, LavalinkCacheData>;

export class LavalinkStrategy extends Strategy<LavalinkCache, LavalinkCacheData> {
  get cacheType() {
    return LAVALINK_CACHE_TYPE;
  }

  constructor(priority: number) {
    super(priority);
  }

  private getNode() {
    const shoukaku = getShoukakuInstance();
    if (!shoukaku) {
      throw new Error("Lavalink is not available");
    }
    const node = shoukaku.getIdealNode();
    if (!node) {
      throw new Error("No Lavalink nodes available");
    }
    return node;
  }

  async getInfo(url: string): Promise<{ data: YouTubeJsonFormat; cache: LavalinkCache }> {
    this.logStrategyUsed();
    const node = this.getNode();
    const result = await node.rest.resolve(url);

    if (!result) {
      throw new Error(`Lavalink returned no result for: ${url}`);
    }

    let track: Track;
    switch (result.loadType) {
      case LoadType.TRACK:
        track = result.data;
        break;
      case LoadType.PLAYLIST:
        if (result.data.tracks.length === 0) {
          throw new Error("Lavalink returned empty playlist");
        }
        track = result.data.tracks[result.data.info.selectedTrack] || result.data.tracks[0];
        break;
      case LoadType.SEARCH:
        if (result.data.length === 0) {
          throw new Error("Lavalink search returned no results");
        }
        track = result.data[0];
        break;
      case LoadType.EMPTY:
        throw new Error(`Lavalink found no results for: ${url}`);
      case LoadType.ERROR:
        throw new Error(`Lavalink error: ${result.data.message}`);
      default:
        throw new Error("Unexpected Lavalink load type");
    }

    return {
      data: this.mapToExportable(url, { track }),
      cache: {
        type: LAVALINK_CACHE_TYPE,
        data: { track },
      },
    };
  }

  async fetch(url: string, forceCache: true, cache?: Cache<any, any>): Promise<StrategyFetchResult<LavalinkCache, UrlStreamInfo>>;
  async fetch(url: string, forceCache?: boolean, cache?: Cache<any, any>): Promise<StrategyFetchResult<LavalinkCache, StreamInfo>>;
  async fetch(url: string, _forceCache?: boolean, cache?: Cache<any, any>): Promise<StrategyFetchResult<LavalinkCache, StreamInfo>> {
    this.logStrategyUsed();

    let trackData: LavalinkCacheData;

    if (this.cacheIsValid(cache)) {
      trackData = cache.data;
    } else {
      const node = this.getNode();
      const result = await node.rest.resolve(url);

      if (!result) {
        throw new Error(`Lavalink returned no result for: ${url}`);
      }

      let track: Track;
      switch (result.loadType) {
        case LoadType.TRACK:
          track = result.data;
          break;
        case LoadType.PLAYLIST:
          if (result.data.tracks.length === 0) throw new Error("Empty playlist");
          track = result.data.tracks[result.data.info.selectedTrack] || result.data.tracks[0];
          break;
        case LoadType.SEARCH:
          if (result.data.length === 0) throw new Error("No search results");
          track = result.data[0];
          break;
        case LoadType.EMPTY:
          throw new Error("No results");
        case LoadType.ERROR:
          throw new Error(`Lavalink error: ${result.data.message}`);
        default:
          throw new Error("Unexpected load type");
      }

      trackData = { track };
    }

    // In Lavalink mode, actual streaming is handled by Lavalink.
    // Return a UrlStreamInfo pointing to the original URL; LavalinkBackend.play()
    // will resolve the track again via Lavalink's REST API.
    const streamInfo: UrlStreamInfo = {
      type: "url",
      url: trackData.track.info.uri || url,
      streamType: "unknown",
    };

    return {
      stream: streamInfo as any,
      info: this.mapToExportable(url, trackData),
      relatedVideos: null,
      cache: {
        type: LAVALINK_CACHE_TYPE,
        data: trackData,
      },
    };
  }

  protected mapToExportable(url: string, info: LavalinkCacheData): YouTubeJsonFormat {
    const { track } = info;
    return {
      url: track.info.uri || url,
      title: track.info.title,
      description: "",
      length: Math.floor(track.info.length / 1000),
      channel: track.info.author,
      channelUrl: "",
      thumbnail: track.info.artworkUrl || "",
      isLive: track.info.isStream,
    };
  }

  protected cacheIsValid(cache?: Cache<any, any>): cache is LavalinkCache {
    return cache?.type === LAVALINK_CACHE_TYPE;
  }
}

export default LavalinkStrategy;
