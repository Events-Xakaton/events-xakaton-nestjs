import { Injectable } from '@nestjs/common';
import { Ctx, Start, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

import { AppConfigService, EnvVariableName } from '@shared/config';

@Injectable()
@Update()
export class BotUpdate {
  constructor(private readonly config: AppConfigService) {}

  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    const miniAppUrl = this.config.getOrThrow(EnvVariableName.MINI_APP_URL);
    const firstName = ctx.from?.first_name ?? 'путешественник';

    await ctx.reply(
      [
        `👋 Привет, ${firstName}!`,
        '',
        `Добро пожаловать в <b>Party Maker</b> — место, где создают движ.`,
        '',
        `🏛 <b>Создавай</b> свой клуб и собирай команду единомышленников`,
        `📅 <b>Запускай</b> ивенты или присоединяйся к чужим`,
        `⭐ <b>Копи баллы</b>, повышай ранг и поднимайся в лидерборде`,
        `🎰 <b>Крути колесо фортуны</b> и получай призы!`,
        '',
        `Жми кнопку ниже и начинай прямо сейчас 👇`,
      ].join('\n'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.webApp('🚀 Открыть Party Maker', miniAppUrl),
        ]),
      },
    );
  }
}
