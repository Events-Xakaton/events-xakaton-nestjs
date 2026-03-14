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
        `Добро пожаловать в <b>Tribe Events</b> — платформу клубов и мероприятий с геймификацией.`,
        '',
        `🏛 <b>Создавай</b> свой клуб и собирай команду единомышленников`,
        `📅 <b>Организуй</b> мероприятия или <b>участвуй</b> в чужих`,
        `🏆 <b>Зарабатывай</b> очки за активность и <b>побеждай</b> в лидерборде`,
        '',
        `Открывай приложение и действуй! 👇`,
      ].join('\n'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.webApp('🚀 Открыть Tribe Events', miniAppUrl),
        ]),
      },
    );
  }
}
