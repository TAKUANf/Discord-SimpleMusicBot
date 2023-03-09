/*
 * Copyright 2021-2023 mtripg6666tdr
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

import type { CommandArgs } from ".";
import type { CommandMessage } from "../Component/CommandMessage";

import { MessageEmbedBuilder } from "@mtripg6666tdr/oceanic-command-resolver/helper";

import { BaseCommand } from ".";
import { getColor } from "../Util/color";

export default class Related extends BaseCommand {
  constructor(){
    super({
      name: "関連動画",
      alias: ["関連曲", "おすすめ", "オススメ", "related", "relatedsong", "r", "recommend"],
      description: "YouTubeから楽曲を再生終了時に、関連曲をキューに自動で追加する機能の有効/無効を設定します",
      unlist: false,
      category: "playlist",
      requiredPermissionsOr: ["admin", "noConnection", "sameVc"],
      shouldDefer: false,
    });
  }

  async run(message: CommandMessage, options: CommandArgs){
    options.server.updateBoundChannel(message);
    if(options.server.addRelated){
      options.server.addRelated = false;
      message.reply("❌関連曲自動再生をオフにしました").catch(this.logger.error);
    }else{
      options.server.addRelated = true;
      const embed = new MessageEmbedBuilder()
        .setTitle("⭕関連曲自動再生をオンにしました")
        .setDescription("YouTubeからの楽曲再生終了時に、関連曲をキューの末尾に自動追加する機能です。\r\n※YouTube以外のソースからの再生時、ループ有効時には追加されません")
        .setColor(getColor("RELATIVE_SETUP"))
        .toOceanic()
      ;
      message.reply({ embeds: [embed] });
    }
  }
}
