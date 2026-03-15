import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Фиксированные UUID — гарантируют идемпотентность при повторном запуске
const CLUB_IDS = {
  sport: '00000000-0000-0000-0000-000000000101',
  tech: '00000000-0000-0000-0000-000000000102',
  music: '00000000-0000-0000-0000-000000000103',
  art: '00000000-0000-0000-0000-000000000104',
  food: '00000000-0000-0000-0000-000000000105',
  books: '00000000-0000-0000-0000-000000000106',
};

const EVENT_IDS = {
  // Прошедшие (8)
  pastRun: '00000000-0000-0000-0000-000000000201',
  pastHackathon: '00000000-0000-0000-0000-000000000202',
  pastYoga: '00000000-0000-0000-0000-000000000203',
  pastReact: '00000000-0000-0000-0000-000000000204',
  pastConcert: '00000000-0000-0000-0000-000000000205',
  pastPainting: '00000000-0000-0000-0000-000000000206',
  pastCooking: '00000000-0000-0000-0000-000000000207',
  pastBookclub: '00000000-0000-0000-0000-000000000208',
  // Идут сейчас (2)
  ongoingTech: '00000000-0000-0000-0000-000000000211',
  ongoingSport: '00000000-0000-0000-0000-000000000212',
  // Ближайшие (8, в течение 1–7 дней)
  upcomingBike: '00000000-0000-0000-0000-000000000221',
  upcomingJazz: '00000000-0000-0000-0000-000000000222',
  upcomingFood: '00000000-0000-0000-0000-000000000223',
  upcomingBooks: '00000000-0000-0000-0000-000000000224',
  upcomingArt: '00000000-0000-0000-0000-000000000225',
  upcomingTech2: '00000000-0000-0000-0000-000000000226',
  upcomingSport2: '00000000-0000-0000-0000-000000000227',
  upcomingReact: '00000000-0000-0000-0000-000000000228',
  // Дальние (2, через 2–3 недели)
  upcomingFarSport: '00000000-0000-0000-0000-000000000231',
  upcomingFarTech: '00000000-0000-0000-0000-000000000232',
  // Отменённые (2)
  cancelledFootball: '00000000-0000-0000-0000-000000000241',
  cancelledWorkshop: '00000000-0000-0000-0000-000000000242',
};

type MemberRole = 'owner' | 'admin' | 'event_manager' | 'member';
type EntityType = 'club' | 'event';
type NotifType = 'new_follower' | 'event_changed';
type PointsEntry = {
  userId: string;
  ruleCode: string;
  deltaPoints: number;
  referenceId: string;
  eventId?: string;
  clubId?: string;
};

async function main(): Promise<void> {
  const now = Date.now();

  // ── 1. Роли ──────────────────────────────────────────────────────────────
  const roleCodes = ['Member', 'ClubAdmin', 'PlatformAdmin'] as const;
  for (const code of roleCodes) {
    await prisma.role.upsert({ where: { code }, update: {}, create: { code } });
  }

  const [memberRole, clubAdminRole, platformAdminRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({
      where: { code: 'Member' },
      select: { id: true },
    }),
    prisma.role.findUniqueOrThrow({
      where: { code: 'ClubAdmin' },
      select: { id: true },
    }),
    prisma.role.findUniqueOrThrow({
      where: { code: 'PlatformAdmin' },
      select: { id: true },
    }),
  ]);

  // ── 2. Пользователи (250) ─────────────────────────────────────────────────
  const tgBase = 880000000n;
  const users: Array<{ id: string; telegramUserId: bigint }> = [];

  for (let i = 1; i <= 250; i++) {
    const telegramUserId = tgBase + BigInt(i);
    const user = await prisma.user.upsert({
      where: { telegramUserId },
      update: {},
      create: {
        telegramUserId,
        fullName: `Demo User ${i}`,
        telegramUsername: `demo_user_${i}`,
        isVerified: true,
      },
      select: { id: true, telegramUserId: true },
    });
    users.push(user);

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: memberRole.id } },
      update: {},
      create: { userId: user.id, roleId: memberRole.id },
    });
  }

  // users[0]: PlatformAdmin; users[0–5]: ClubAdmin
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: users[0].id, roleId: platformAdminRole.id },
    },
    update: {},
    create: { userId: users[0].id, roleId: platformAdminRole.id },
  });
  for (const idx of [0, 1, 2, 3, 4, 5]) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: users[idx].id, roleId: clubAdminRole.id },
      },
      update: {},
      create: { userId: users[idx].id, roleId: clubAdminRole.id },
    });
  }

  // ── 3. Клубы ─────────────────────────────────────────────────────────────
  const clubSport = await prisma.club.upsert({
    where: { id: CLUB_IDS.sport },
    update: {},
    create: {
      id: CLUB_IDS.sport,
      creatorUserId: users[0].id,
      title: 'Morning Runners',
      description:
        'Еженедельные пробежки и спортивные активности для всех уровней подготовки. Бегаем вместе — веселее!',
      categoryCode: 'Спорт',
      tags: {
        create: [
          { tag: 'бег' },
          { tag: 'фитнес' },
          { tag: 'здоровье' },
          { tag: 'утро' },
        ],
      },
    },
  });

  const clubTech = await prisma.club.upsert({
    where: { id: CLUB_IDS.tech },
    update: {},
    create: {
      id: CLUB_IDS.tech,
      creatorUserId: users[1].id,
      title: 'Tech & Coffee',
      description:
        'Встречи технарей: доклады, воркшопы, хакатоны, нетворкинг. Каждую неделю новая тема.',
      categoryCode: 'Технологии',
      tags: {
        create: [
          { tag: 'it' },
          { tag: 'разработка' },
          { tag: 'нетворкинг' },
          { tag: 'ai' },
        ],
      },
    },
  });

  const clubMusic = await prisma.club.upsert({
    where: { id: CLUB_IDS.music },
    update: {},
    create: {
      id: CLUB_IDS.music,
      creatorUserId: users[2].id,
      title: 'Sound Wave',
      description:
        'Клуб любителей музыки: джемы, разборы альбомов, живые концерты и музыкальные эксперименты.',
      categoryCode: 'Музыка',
      tags: {
        create: [
          { tag: 'джаз' },
          { tag: 'рок' },
          { tag: 'джем' },
          { tag: 'концерт' },
        ],
      },
    },
  });

  const clubArt = await prisma.club.upsert({
    where: { id: CLUB_IDS.art },
    update: {},
    create: {
      id: CLUB_IDS.art,
      creatorUserId: users[3].id,
      title: 'Creative Studio',
      description:
        'Рисование, скетчинг, акварель и цифровое искусство. Открыты для всех — опыт не нужен.',
      categoryCode: 'Искусство',
      tags: {
        create: [{ tag: 'рисование' }, { tag: 'акварель' }, { tag: 'скетч' }],
      },
    },
  });

  const clubFood = await prisma.club.upsert({
    where: { id: CLUB_IDS.food },
    update: {},
    create: {
      id: CLUB_IDS.food,
      creatorUserId: users[4].id,
      title: 'Gastro Club',
      description:
        'Кулинарные мастер-классы, дегустации и походы по ресторанам. Готовим и едим вместе!',
      categoryCode: 'Еда',
      tags: {
        create: [
          { tag: 'кулинария' },
          { tag: 'дегустация' },
          { tag: 'рестораны' },
        ],
      },
    },
  });

  const clubBooks = await prisma.club.upsert({
    where: { id: CLUB_IDS.books },
    update: {},
    create: {
      id: CLUB_IDS.books,
      creatorUserId: users[5].id,
      title: 'Book Nerds',
      description:
        'Книжный клуб: обсуждения, авторские встречи, читательские марафоны. Одна книга в месяц.',
      categoryCode: 'Образование',
      tags: {
        create: [{ tag: 'книги' }, { tag: 'чтение' }, { tag: 'литература' }],
      },
    },
  });

  // ── 4. Членства в клубах ─────────────────────────────────────────────────
  // Распределение пользователей по клубам (без пересечений для простоты):
  // Sport   : users[0-5] (admins/owner) + users[6-35]  (30 members) = 36
  // Tech    : users[1] (owner) + users[36-65]  (30 members) = 31
  // Music   : users[2] (owner) + users[66-85]  (20 members) = 21
  // Art     : users[3] (owner) + users[86-115] (30 members) = 31
  // Food    : users[4] (owner) + users[116-145](30 members) = 31
  // Books   : users[5] (owner) + users[146-175](30 members) = 31
  const memberships: Array<{
    clubId: string;
    userId: string;
    role: MemberRole;
  }> = [
    // Sport
    { clubId: clubSport.id, userId: users[0].id, role: 'owner' },
    { clubId: clubSport.id, userId: users[1].id, role: 'admin' },
    { clubId: clubSport.id, userId: users[2].id, role: 'admin' },
    { clubId: clubSport.id, userId: users[3].id, role: 'event_manager' },
    { clubId: clubSport.id, userId: users[4].id, role: 'event_manager' },
    { clubId: clubSport.id, userId: users[5].id, role: 'member' },
    ...Array.from({ length: 30 }, (_, i) => ({
      clubId: clubSport.id,
      userId: users[6 + i].id,
      role: 'member' as MemberRole,
    })),
    // Tech
    { clubId: clubTech.id, userId: users[1].id, role: 'owner' },
    { clubId: clubTech.id, userId: users[0].id, role: 'admin' },
    ...Array.from({ length: 30 }, (_, i) => ({
      clubId: clubTech.id,
      userId: users[36 + i].id,
      role: 'member' as MemberRole,
    })),
    // Music
    { clubId: clubMusic.id, userId: users[2].id, role: 'owner' },
    ...Array.from({ length: 20 }, (_, i) => ({
      clubId: clubMusic.id,
      userId: users[66 + i].id,
      role: 'member' as MemberRole,
    })),
    // Art
    { clubId: clubArt.id, userId: users[3].id, role: 'owner' },
    ...Array.from({ length: 30 }, (_, i) => ({
      clubId: clubArt.id,
      userId: users[86 + i].id,
      role: 'member' as MemberRole,
    })),
    // Food
    { clubId: clubFood.id, userId: users[4].id, role: 'owner' },
    ...Array.from({ length: 30 }, (_, i) => ({
      clubId: clubFood.id,
      userId: users[116 + i].id,
      role: 'member' as MemberRole,
    })),
    // Books
    { clubId: clubBooks.id, userId: users[5].id, role: 'owner' },
    ...Array.from({ length: 30 }, (_, i) => ({
      clubId: clubBooks.id,
      userId: users[146 + i].id,
      role: 'member' as MemberRole,
    })),
  ];

  for (const m of memberships) {
    await prisma.clubMembership.upsert({
      where: { clubId_userId: { clubId: m.clubId, userId: m.userId } },
      update: { status: 'joined', role: m.role },
      create: {
        clubId: m.clubId,
        userId: m.userId,
        status: 'joined',
        role: m.role,
      },
    });
  }

  // ── 5. События (22 штуки) ─────────────────────────────────────────────────
  // Даты всегда пересчитываются в update — события не "протухают" при повторном сиде

  // ── Прошедшие (8) ────────────────────────────────────────────────────────
  const eventPastRun = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastRun },
    update: {
      startsAtUtc: new Date(now - 3 * DAY),
      endsAtUtc: new Date(now - 3 * DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.pastRun,
      clubId: clubSport.id,
      creatorUserId: users[0].id,
      title: 'Утренняя пробежка — Воробьёвы горы',
      description:
        'Пробежка 8 км по набережной. Сбор у смотровой площадки. Темп 5:30/км.',
      locationOrLink: 'Воробьёвы горы, смотровая площадка',
      startsAtUtc: new Date(now - 3 * DAY),
      endsAtUtc: new Date(now - 3 * DAY + 2 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'бег' }, { tag: 'утро' }] },
    },
  });

  const eventPastHackathon = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastHackathon },
    update: {
      startsAtUtc: new Date(now - 7 * DAY),
      endsAtUtc: new Date(now - 7 * DAY + 4 * HOUR),
    },
    create: {
      id: EVENT_IDS.pastHackathon,
      clubId: clubTech.id,
      creatorUserId: users[1].id,
      title: 'Mini Hackathon: AI Tools',
      description:
        'Четырёхчасовой хакатон по созданию инструментов на базе LLM. Формируйте команды заранее.',
      locationOrLink: 'Coworking Space, ул. Никольская 10',
      startsAtUtc: new Date(now - 7 * DAY),
      endsAtUtc: new Date(now - 7 * DAY + 4 * HOUR),
      status: 'upcoming',
      maxParticipants: 40,
      tags: { create: [{ tag: 'ai' }, { tag: 'хакатон' }] },
    },
  });

  const eventPastYoga = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastYoga },
    update: {
      startsAtUtc: new Date(now - 5 * DAY),
      endsAtUtc: new Date(now - 5 * DAY + HOUR),
    },
    create: {
      id: EVENT_IDS.pastYoga,
      clubId: clubSport.id,
      creatorUserId: users[3].id,
      title: 'Йога в парке',
      description:
        'Утренняя йога на свежем воздухе. Уровень: начинающий и средний. Коврик взять с собой.',
      locationOrLink: 'Парк Сокольники, поляна у главного входа',
      startsAtUtc: new Date(now - 5 * DAY),
      endsAtUtc: new Date(now - 5 * DAY + HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'йога' }, { tag: 'парк' }] },
    },
  });

  const eventPastReact = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastReact },
    update: {
      startsAtUtc: new Date(now - 10 * DAY),
      endsAtUtc: new Date(now - 10 * DAY + 3 * HOUR),
    },
    create: {
      id: EVENT_IDS.pastReact,
      clubId: clubTech.id,
      creatorUserId: users[1].id,
      title: 'React + TypeScript: Best Practices 2025',
      description:
        'Воркшоп по современным паттернам React: Server Components, Suspense, новый компилятор.',
      locationOrLink: 'Офис Яндекс, ул. Льва Толстого 16',
      startsAtUtc: new Date(now - 10 * DAY),
      endsAtUtc: new Date(now - 10 * DAY + 3 * HOUR),
      status: 'upcoming',
      maxParticipants: 30,
      tags: {
        create: [{ tag: 'react' }, { tag: 'typescript' }, { tag: 'воркшоп' }],
      },
    },
  });

  const eventPastConcert = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastConcert },
    update: {
      startsAtUtc: new Date(now - 4 * DAY),
      endsAtUtc: new Date(now - 4 * DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.pastConcert,
      clubId: clubMusic.id,
      creatorUserId: users[2].id,
      title: 'Acoustic Evening',
      description:
        'Акустический вечер участников клуба. Гитара, бас, перкуссия. Вход свободный.',
      locationOrLink: 'Арт-пространство "Цех", Берсеневская набережная 2',
      startsAtUtc: new Date(now - 4 * DAY),
      endsAtUtc: new Date(now - 4 * DAY + 2 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'акустика' }, { tag: 'концерт' }] },
    },
  });

  const eventPastPainting = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastPainting },
    update: {
      startsAtUtc: new Date(now - 6 * DAY),
      endsAtUtc: new Date(now - 6 * DAY + 3 * HOUR),
    },
    create: {
      id: EVENT_IDS.pastPainting,
      clubId: clubArt.id,
      creatorUserId: users[3].id,
      title: 'Акварельный пленэр',
      description:
        'Рисуем городские пейзажи акварелью на пленэре. Материалы предоставляются.',
      locationOrLink: 'Патриаршие пруды',
      startsAtUtc: new Date(now - 6 * DAY),
      endsAtUtc: new Date(now - 6 * DAY + 3 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'акварель' }, { tag: 'пленэр' }] },
    },
  });

  const eventPastCooking = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastCooking },
    update: {
      startsAtUtc: new Date(now - 2 * DAY),
      endsAtUtc: new Date(now - 2 * DAY + 3 * HOUR),
    },
    create: {
      id: EVENT_IDS.pastCooking,
      clubId: clubFood.id,
      creatorUserId: users[4].id,
      title: 'Мастер-класс: итальянская паста',
      description:
        'Учимся готовить три вида пасты с нуля: тальятелле, равиоли и паппарделле.',
      locationOrLink: 'Кулинарная студия "Culinaryon", ул. Садовническая 9',
      startsAtUtc: new Date(now - 2 * DAY),
      endsAtUtc: new Date(now - 2 * DAY + 3 * HOUR),
      status: 'upcoming',
      maxParticipants: 20,
      tags: { create: [{ tag: 'паста' }, { tag: 'мастер-класс' }] },
    },
  });

  const eventPastBookclub = await prisma.event.upsert({
    where: { id: EVENT_IDS.pastBookclub },
    update: {
      startsAtUtc: new Date(now - 8 * DAY),
      endsAtUtc: new Date(now - 8 * DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.pastBookclub,
      clubId: clubBooks.id,
      creatorUserId: users[5].id,
      title: 'Обсуждение: "Мастер и Маргарита"',
      description:
        'Разбираем роман Булгакова: структура, символизм, актуальность. Книгу прочитать заранее.',
      locationOrLink: 'Антикафе "Циолковский", ул. Бауманская 35',
      startsAtUtc: new Date(now - 8 * DAY),
      endsAtUtc: new Date(now - 8 * DAY + 2 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'классика' }, { tag: 'обсуждение' }] },
    },
  });

  // ── Идут сейчас (2) ───────────────────────────────────────────────────────
  const eventOngoingTech = await prisma.event.upsert({
    where: { id: EVENT_IDS.ongoingTech },
    update: {
      startsAtUtc: new Date(now - 30 * 60 * 1000),
      endsAtUtc: new Date(now + 90 * 60 * 1000),
      minLevel: 2,
    },
    create: {
      id: EVENT_IDS.ongoingTech,
      clubId: clubTech.id,
      creatorUserId: users[1].id,
      title: 'Tech Meetup: NestJS Deep Dive',
      description:
        'Разбираем CQRS, EventBus и микросервисы в NestJS. Живой доклад + Q&A.',
      locationOrLink: 'https://meet.google.com/abc-defg-hij',
      startsAtUtc: new Date(now - 30 * 60 * 1000),
      endsAtUtc: new Date(now + 90 * 60 * 1000),
      status: 'upcoming',
      minLevel: 2,
      tags: { create: [{ tag: 'nestjs' }, { tag: 'backend' }] },
    },
  });

  const eventOngoingSport = await prisma.event.upsert({
    where: { id: EVENT_IDS.ongoingSport },
    update: {
      startsAtUtc: new Date(now - HOUR),
      endsAtUtc: new Date(now + HOUR),
    },
    create: {
      id: EVENT_IDS.ongoingSport,
      clubId: clubSport.id,
      creatorUserId: users[0].id,
      title: 'Интервальная тренировка на стадионе',
      description:
        '8×400м интервалы + разминка и заминка. Приносите шиповки или кроссовки.',
      locationOrLink: 'Стадион Лужники, тренировочный манеж',
      startsAtUtc: new Date(now - HOUR),
      endsAtUtc: new Date(now + HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'интервалы' }, { tag: 'стадион' }] },
    },
  });

  // ── Ближайшие (8, в течение 1–7 дней) ────────────────────────────────────
  const eventUpcomingBike = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingBike },
    update: {
      startsAtUtc: new Date(now + 2 * DAY),
      endsAtUtc: new Date(now + 2 * DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.upcomingBike,
      clubId: clubSport.id,
      creatorUserId: users[0].id,
      title: 'Велопрогулка — парк Горького',
      description:
        'Маршрут 20 км по парку и набережной. Берите велосипеды и хорошее настроение!',
      locationOrLink: 'ЦПКиО им. Горького, главный вход',
      startsAtUtc: new Date(now + 2 * DAY),
      endsAtUtc: new Date(now + 2 * DAY + 2 * HOUR),
      status: 'upcoming',
      maxParticipants: 25,
      tags: { create: [{ tag: 'велосипед' }, { tag: 'парк' }] },
    },
  });

  const eventUpcomingJazz = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingJazz },
    update: {
      startsAtUtc: new Date(now + 5 * DAY),
      endsAtUtc: new Date(now + 5 * DAY + 3 * HOUR),
    },
    create: {
      id: EVENT_IDS.upcomingJazz,
      clubId: clubMusic.id,
      creatorUserId: users[2].id,
      title: 'Jazz Jam Session',
      description:
        'Открытая джазовая сессия. Приносите инструменты или просто слушайте.',
      locationOrLink: 'Бар "Синяя птица", Малая Дмитровка 23',
      startsAtUtc: new Date(now + 5 * DAY),
      endsAtUtc: new Date(now + 5 * DAY + 3 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'джаз' }, { tag: 'живая музыка' }] },
    },
  });

  const eventUpcomingFood = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingFood },
    update: {
      startsAtUtc: new Date(now + DAY),
      endsAtUtc: new Date(now + DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.upcomingFood,
      clubId: clubFood.id,
      creatorUserId: users[4].id,
      title: 'Дегустация грузинских вин',
      description:
        'Сомелье проведёт дегустацию 6 грузинских вин с закусками. Количество мест ограничено.',
      locationOrLink: 'Ресторан "Казбек", Малая Грузинская 5',
      startsAtUtc: new Date(now + DAY),
      endsAtUtc: new Date(now + DAY + 2 * HOUR),
      status: 'upcoming',
      maxParticipants: 18,
      tags: { create: [{ tag: 'вино' }, { tag: 'дегустация' }] },
    },
  });

  const eventUpcomingBooks = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingBooks },
    update: {
      startsAtUtc: new Date(now + 6 * DAY),
      endsAtUtc: new Date(now + 6 * DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.upcomingBooks,
      clubId: clubBooks.id,
      creatorUserId: users[5].id,
      title: 'Обсуждение: "Атлант расправил плечи"',
      description:
        'Разбираем философию объективизма Айн Рэнд. Читаем только части I и II.',
      locationOrLink: 'Антикафе "Циолковский", ул. Бауманская 35',
      startsAtUtc: new Date(now + 6 * DAY),
      endsAtUtc: new Date(now + 6 * DAY + 2 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'философия' }, { tag: 'обсуждение' }] },
    },
  });

  const eventUpcomingArt = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingArt },
    update: {
      startsAtUtc: new Date(now + 4 * DAY),
      endsAtUtc: new Date(now + 4 * DAY + 3 * HOUR),
    },
    create: {
      id: EVENT_IDS.upcomingArt,
      clubId: clubArt.id,
      creatorUserId: users[3].id,
      title: 'Скетчинг: городская архитектура',
      description:
        'Рисуем фасады московских зданий в технике быстрого скетча. Карандаши и маркеры.',
      locationOrLink: 'Красная площадь, у Исторического музея',
      startsAtUtc: new Date(now + 4 * DAY),
      endsAtUtc: new Date(now + 4 * DAY + 3 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'скетч' }, { tag: 'архитектура' }] },
    },
  });

  const eventUpcomingTech2 = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingTech2 },
    update: {
      startsAtUtc: new Date(now + 3 * DAY),
      endsAtUtc: new Date(now + 3 * DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.upcomingTech2,
      clubId: clubTech.id,
      creatorUserId: users[36].id,
      title: 'Lightning Talks: Open Source в продакшне',
      description:
        '5 коротких докладов по 10 минут о реальном опыте open-source в боевых проектах.',
      locationOrLink: 'Бар-коворкинг "Циферблат", Покровка 12',
      startsAtUtc: new Date(now + 3 * DAY),
      endsAtUtc: new Date(now + 3 * DAY + 2 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'open-source' }, { tag: 'доклады' }] },
    },
  });

  const eventUpcomingSport2 = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingSport2 },
    update: {
      startsAtUtc: new Date(now + 7 * DAY),
      endsAtUtc: new Date(now + 7 * DAY + 2 * HOUR),
    },
    create: {
      id: EVENT_IDS.upcomingSport2,
      clubId: clubSport.id,
      creatorUserId: users[4].id,
      title: 'Полумарафон: тренировочный забег',
      description:
        'Подготовительный забег 10 км перед городским полумарафоном. Темп свободный.',
      locationOrLink: 'Набережная Москвы-реки, старт у Крымского моста',
      startsAtUtc: new Date(now + 7 * DAY),
      endsAtUtc: new Date(now + 7 * DAY + 2 * HOUR),
      status: 'upcoming',
      tags: { create: [{ tag: 'бег' }, { tag: 'набережная' }] },
    },
  });

  const eventUpcomingReact = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingReact },
    update: {
      startsAtUtc: new Date(now + 4 * DAY + 4 * HOUR),
      endsAtUtc: new Date(now + 4 * DAY + 7 * HOUR),
      minLevel: 3,
    },
    create: {
      id: EVENT_IDS.upcomingReact,
      clubId: clubTech.id,
      creatorUserId: users[1].id,
      title: 'Воркшоп: Prisma + NestJS от А до Я',
      description:
        'Строим типобезопасный API с нуля: схема, миграции, CQRS, тесты.',
      locationOrLink: 'https://zoom.us/j/techcoffee',
      startsAtUtc: new Date(now + 4 * DAY + 4 * HOUR),
      endsAtUtc: new Date(now + 4 * DAY + 7 * HOUR),
      status: 'upcoming',
      maxParticipants: 50,
      minLevel: 3,
      tags: {
        create: [{ tag: 'prisma' }, { tag: 'nestjs' }, { tag: 'воркшоп' }],
      },
    },
  });

  // ── Дальние (2, через 2–3 недели) ────────────────────────────────────────
  const eventUpcomingFarSport = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingFarSport },
    update: {
      startsAtUtc: new Date(now + 14 * DAY),
      endsAtUtc: new Date(now + 14 * DAY + 5 * HOUR),
      minLevel: 3,
    },
    create: {
      id: EVENT_IDS.upcomingFarSport,
      clubId: clubSport.id,
      creatorUserId: users[0].id,
      title: 'Трейлран: Подмосковные леса',
      description:
        'Трейловый забег 25 км по лесным тропам Подмосковья. Обязательна регистрация заранее.',
      locationOrLink: 'Ст. м. Бунинская аллея, парковка',
      startsAtUtc: new Date(now + 14 * DAY),
      endsAtUtc: new Date(now + 14 * DAY + 5 * HOUR),
      status: 'upcoming',
      maxParticipants: 60,
      minLevel: 3,
      tags: { create: [{ tag: 'трейл' }, { tag: 'природа' }] },
    },
  });

  const eventUpcomingFarTech = await prisma.event.upsert({
    where: { id: EVENT_IDS.upcomingFarTech },
    update: {
      startsAtUtc: new Date(now + 21 * DAY),
      endsAtUtc: new Date(now + 21 * DAY + 8 * HOUR),
      minLevel: 4,
    },
    create: {
      id: EVENT_IDS.upcomingFarTech,
      clubId: clubTech.id,
      creatorUserId: users[1].id,
      title: 'Hackathon Spring 2026',
      description:
        'Полноценный 8-часовой хакатон. Тема — платформы для комьюнити. Призовой фонд 50 000 ₽.',
      locationOrLink: 'Digital October, Берсеневская набережная 6с3',
      startsAtUtc: new Date(now + 21 * DAY),
      endsAtUtc: new Date(now + 21 * DAY + 8 * HOUR),
      status: 'upcoming',
      maxParticipants: 100,
      minLevel: 4,
      tags: { create: [{ tag: 'хакатон' }, { tag: 'призы' }] },
    },
  });

  // ── Отменённые (2) ────────────────────────────────────────────────────────
  await prisma.event.upsert({
    where: { id: EVENT_IDS.cancelledFootball },
    update: {},
    create: {
      id: EVENT_IDS.cancelledFootball,
      clubId: clubSport.id,
      creatorUserId: users[0].id,
      title: 'Футбольный турнир 5×5',
      description:
        'Отменено из-за плохих погодных условий. Перенос дата уточняется.',
      locationOrLink: 'Стадион "Локомотив", малое поле',
      startsAtUtc: new Date(now + DAY + 3 * HOUR),
      endsAtUtc: new Date(now + DAY + 6 * HOUR),
      status: 'cancelled',
    },
  });

  await prisma.event.upsert({
    where: { id: EVENT_IDS.cancelledWorkshop },
    update: {},
    create: {
      id: EVENT_IDS.cancelledWorkshop,
      clubId: clubTech.id,
      creatorUserId: users[1].id,
      title: 'Kubernetes для разработчиков',
      description:
        'Отменено: спикер заболел. Мероприятие будет перезапланировано.',
      locationOrLink: 'Онлайн, ссылка будет выслана',
      startsAtUtc: new Date(now + 3 * DAY + 2 * HOUR),
      endsAtUtc: new Date(now + 3 * DAY + 5 * HOUR),
      status: 'cancelled',
    },
  });

  // ── 6. Участия в событиях ─────────────────────────────────────────────────
  const participations: Array<{ eventId: string; userId: string }> = [
    // Прошедшие
    ...Array.from({ length: 28 }, (_, i) => ({
      eventId: eventPastRun.id,
      userId: users[6 + i].id,
    })),
    ...Array.from({ length: 38 }, (_, i) => ({
      eventId: eventPastHackathon.id,
      userId: users[36 + i].id,
    })),
    ...Array.from({ length: 22 }, (_, i) => ({
      eventId: eventPastYoga.id,
      userId: users[6 + i].id,
    })),
    ...Array.from({ length: 25 }, (_, i) => ({
      eventId: eventPastReact.id,
      userId: users[36 + i].id,
    })),
    ...Array.from({ length: 18 }, (_, i) => ({
      eventId: eventPastConcert.id,
      userId: users[66 + i].id,
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      eventId: eventPastPainting.id,
      userId: users[86 + i].id,
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      eventId: eventPastCooking.id,
      userId: users[116 + i].id,
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      eventId: eventPastBookclub.id,
      userId: users[146 + i].id,
    })),
    // Текущие
    ...Array.from({ length: 28 }, (_, i) => ({
      eventId: eventOngoingTech.id,
      userId: users[36 + i].id,
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      eventId: eventOngoingSport.id,
      userId: users[6 + i].id,
    })),
    // Ближайшие
    ...Array.from({ length: 20 }, (_, i) => ({
      eventId: eventUpcomingBike.id,
      userId: users[6 + i].id,
    })),
    ...Array.from({ length: 18 }, (_, i) => ({
      eventId: eventUpcomingJazz.id,
      userId: users[66 + i].id,
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
      eventId: eventUpcomingFood.id,
      userId: users[116 + i].id,
    })),
    ...Array.from({ length: 16 }, (_, i) => ({
      eventId: eventUpcomingBooks.id,
      userId: users[146 + i].id,
    })),
    ...Array.from({ length: 14 }, (_, i) => ({
      eventId: eventUpcomingArt.id,
      userId: users[86 + i].id,
    })),
    ...Array.from({ length: 22 }, (_, i) => ({
      eventId: eventUpcomingTech2.id,
      userId: users[36 + i].id,
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      eventId: eventUpcomingSport2.id,
      userId: users[6 + i].id,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      eventId: eventUpcomingReact.id,
      userId: users[36 + i].id,
    })),
    // Дальние
    ...Array.from({ length: 25 }, (_, i) => ({
      eventId: eventUpcomingFarSport.id,
      userId: users[6 + i].id,
    })),
    ...Array.from({ length: 40 }, (_, i) => ({
      eventId: eventUpcomingFarTech.id,
      userId: users[36 + i].id,
    })),
  ];

  for (const p of participations) {
    await prisma.eventParticipation.upsert({
      where: { eventId_userId: { eventId: p.eventId, userId: p.userId } },
      update: { status: 'joined' },
      create: { eventId: p.eventId, userId: p.userId, status: 'joined' },
    });
  }

  // ── 7. Подтверждения посещаемости (прошедшие события) ────────────────────
  const attendanceData: Array<{
    eventId: string;
    startIdx: number;
    count: number;
  }> = [
    { eventId: eventPastRun.id, startIdx: 6, count: 20 },
    { eventId: eventPastHackathon.id, startIdx: 36, count: 30 },
    { eventId: eventPastYoga.id, startIdx: 6, count: 15 },
    { eventId: eventPastReact.id, startIdx: 36, count: 18 },
    { eventId: eventPastConcert.id, startIdx: 66, count: 14 },
    { eventId: eventPastPainting.id, startIdx: 86, count: 16 },
    { eventId: eventPastCooking.id, startIdx: 116, count: 12 },
    { eventId: eventPastBookclub.id, startIdx: 146, count: 15 },
  ];

  for (const { eventId, startIdx, count } of attendanceData) {
    for (let i = 0; i < count; i++) {
      await prisma.attendanceConfirmation.upsert({
        where: { eventId_userId: { eventId, userId: users[startIdx + i].id } },
        update: {},
        create: {
          eventId,
          userId: users[startIdx + i].id,
          rating: (i % 3) + 3,
        },
      });
    }
  }

  // ── 8. Комментарии ────────────────────────────────────────────────────────
  const comments: Array<{
    entityType: EntityType;
    entityId: string;
    authorUserId: string;
    text: string;
  }> = [
    // Клубы
    {
      entityType: 'club',
      entityId: clubSport.id,
      authorUserId: users[6].id,
      text: 'Отличный клуб! Уже третий месяц бегаем вместе.',
    },
    {
      entityType: 'club',
      entityId: clubSport.id,
      authorUserId: users[7].id,
      text: 'Хорошая атмосфера, принимают всех независимо от уровня.',
    },
    {
      entityType: 'club',
      entityId: clubSport.id,
      authorUserId: users[8].id,
      text: 'Организаторы молодцы — всегда продуманные маршруты.',
    },
    {
      entityType: 'club',
      entityId: clubTech.id,
      authorUserId: users[36].id,
      text: 'Супер-митапы, каждый раз узнаю что-то новое!',
    },
    {
      entityType: 'club',
      entityId: clubTech.id,
      authorUserId: users[37].id,
      text: 'Когда следующий хакатон? Жду не дождусь.',
    },
    {
      entityType: 'club',
      entityId: clubTech.id,
      authorUserId: users[38].id,
      text: 'Лучшее комьюнити разработчиков в Москве.',
    },
    {
      entityType: 'club',
      entityId: clubMusic.id,
      authorUserId: users[66].id,
      text: 'Джазовые джемы — лучшая пятница!',
    },
    {
      entityType: 'club',
      entityId: clubMusic.id,
      authorUserId: users[67].id,
      text: 'Рад, что нашёл людей с похожим вкусом в музыке.',
    },
    {
      entityType: 'club',
      entityId: clubArt.id,
      authorUserId: users[86].id,
      text: 'Никогда не думал, что смогу рисовать. Теперь хожу каждую неделю!',
    },
    {
      entityType: 'club',
      entityId: clubFood.id,
      authorUserId: users[116].id,
      text: 'После мастер-класса по пасте дома теперь готовлю итальянскую кухню.',
    },
    {
      entityType: 'club',
      entityId: clubBooks.id,
      authorUserId: users[146].id,
      text: 'Такого глубокого обсуждения книг я ещё не встречал.',
    },
    // Прошедшие события
    {
      entityType: 'event',
      entityId: eventPastRun.id,
      authorUserId: users[6].id,
      text: 'Отличная пробежка! Маршрут был живописным.',
    },
    {
      entityType: 'event',
      entityId: eventPastRun.id,
      authorUserId: users[7].id,
      text: 'Немного устал, но оно того стоило.',
    },
    {
      entityType: 'event',
      entityId: eventPastRun.id,
      authorUserId: users[8].id,
      text: 'Личный рекорд на 8 км! Спасибо темп-лидеру.',
    },
    {
      entityType: 'event',
      entityId: eventPastHackathon.id,
      authorUserId: users[36].id,
      text: 'Наша команда сделала чат-бота на GPT-4 за 4 часа!',
    },
    {
      entityType: 'event',
      entityId: eventPastHackathon.id,
      authorUserId: users[37].id,
      text: 'Классный формат, хочу ещё такой.',
    },
    {
      entityType: 'event',
      entityId: eventPastReact.id,
      authorUserId: users[38].id,
      text: 'Server Components наконец-то начали щёлкать в голове после этого доклада.',
    },
    {
      entityType: 'event',
      entityId: eventPastConcert.id,
      authorUserId: users[66].id,
      text: 'Акустика была потрясающей. Ждём следующего!',
    },
    {
      entityType: 'event',
      entityId: eventPastPainting.id,
      authorUserId: users[86].id,
      text: 'Первый пленэр в жизни — и сразу влюбился в акварель.',
    },
    {
      entityType: 'event',
      entityId: eventPastCooking.id,
      authorUserId: users[116].id,
      text: 'Равиоли получились с первого раза! Шеф объяснял очень доступно.',
    },
    {
      entityType: 'event',
      entityId: eventPastBookclub.id,
      authorUserId: users[146].id,
      text: 'Три часа пролетели незаметно. Булгаков объединяет людей.',
    },
    // Текущие/предстоящие
    {
      entityType: 'event',
      entityId: eventOngoingTech.id,
      authorUserId: users[36].id,
      text: 'Уже онлайн, ждём начала доклада.',
    },
    {
      entityType: 'event',
      entityId: eventOngoingTech.id,
      authorUserId: users[37].id,
      text: 'Презентация уже доступна в чате?',
    },
    {
      entityType: 'event',
      entityId: eventUpcomingBike.id,
      authorUserId: users[6].id,
      text: 'Беру горный велосипед, кто ещё?',
    },
    {
      entityType: 'event',
      entityId: eventUpcomingBike.id,
      authorUserId: users[9].id,
      text: 'Возьму шоссейник, темп держу?',
    },
    {
      entityType: 'event',
      entityId: eventUpcomingJazz.id,
      authorUserId: users[66].id,
      text: 'Принесу контрабас, нужен ли ударник?',
    },
    {
      entityType: 'event',
      entityId: eventUpcomingFood.id,
      authorUserId: users[116].id,
      text: 'Наконец-то грузинские вина! Мест ещё нет?',
    },
    {
      entityType: 'event',
      entityId: eventUpcomingFarTech.id,
      authorUserId: users[36].id,
      text: 'Уже формирую команду. Нужен дизайнер!',
    },
    {
      entityType: 'event',
      entityId: eventUpcomingFarTech.id,
      authorUserId: users[40].id,
      text: 'Я дизайнер, напишите в ЛС.',
    },
  ];

  for (const c of comments) {
    const exists = await prisma.comment.findFirst({
      where: {
        entityType: c.entityType,
        entityId: c.entityId,
        authorUserId: c.authorUserId,
        text: c.text,
      },
    });
    if (!exists) {
      await prisma.comment.create({ data: c });
    }
  }

  // ── 9. Подписки (connections) ─────────────────────────────────────────────
  // Социальный граф: owners популярны, + горизонтальные связи внутри клубов
  const connections: Array<[number, number]> = [
    // Подписки на owners клубов
    [6, 0],
    [7, 0],
    [8, 0],
    [9, 0],
    [10, 0],
    [11, 0],
    [12, 0],
    [13, 0],
    [36, 1],
    [37, 1],
    [38, 1],
    [39, 1],
    [40, 1],
    [41, 1],
    [66, 2],
    [67, 2],
    [68, 2],
    [69, 2],
    [86, 3],
    [87, 3],
    [88, 3],
    [116, 4],
    [117, 4],
    [118, 4],
    [146, 5],
    [147, 5],
    // Взаимные подписки owners
    [0, 1],
    [1, 0],
    [0, 2],
    [2, 0],
    [1, 2],
    [2, 1],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 4],
    [4, 5],
    // Внутри sport клуба
    [6, 7],
    [7, 6],
    [8, 6],
    [9, 7],
    [10, 8],
    [11, 6],
    [12, 9],
    [6, 9],
    [7, 10],
    [8, 11],
    // Внутри tech клуба
    [36, 37],
    [37, 36],
    [38, 36],
    [39, 37],
    [40, 38],
    [41, 36],
    [36, 40],
    [37, 39],
    [38, 41],
    // Кросс-клубные
    [6, 36],
    [36, 6],
    [7, 66],
    [66, 7],
    [8, 86],
    [86, 8],
    [9, 116],
    [10, 146],
    [37, 67],
    [38, 87],
  ];

  for (const [fi, ti] of connections) {
    await prisma.connection.upsert({
      where: {
        followerUserId_followedUserId: {
          followerUserId: users[fi].id,
          followedUserId: users[ti].id,
        },
      },
      update: {},
      create: { followerUserId: users[fi].id, followedUserId: users[ti].id },
    });
  }

  // ── 10. Очки (лидерборд) ─────────────────────────────────────────────────
  const pointsEntries: PointsEntry[] = [
    // Создание клубов
    {
      userId: users[0].id,
      ruleCode: 'club_create',
      deltaPoints: 10,
      referenceId: `seed_cc_${CLUB_IDS.sport}`,
      clubId: clubSport.id,
    },
    {
      userId: users[1].id,
      ruleCode: 'club_create',
      deltaPoints: 10,
      referenceId: `seed_cc_${CLUB_IDS.tech}`,
      clubId: clubTech.id,
    },
    {
      userId: users[2].id,
      ruleCode: 'club_create',
      deltaPoints: 10,
      referenceId: `seed_cc_${CLUB_IDS.music}`,
      clubId: clubMusic.id,
    },
    {
      userId: users[3].id,
      ruleCode: 'club_create',
      deltaPoints: 10,
      referenceId: `seed_cc_${CLUB_IDS.art}`,
      clubId: clubArt.id,
    },
    {
      userId: users[4].id,
      ruleCode: 'club_create',
      deltaPoints: 10,
      referenceId: `seed_cc_${CLUB_IDS.food}`,
      clubId: clubFood.id,
    },
    {
      userId: users[5].id,
      ruleCode: 'club_create',
      deltaPoints: 10,
      referenceId: `seed_cc_${CLUB_IDS.books}`,
      clubId: clubBooks.id,
    },
    // Создание событий
    {
      userId: users[0].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.pastRun}`,
      eventId: eventPastRun.id,
    },
    {
      userId: users[0].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingBike}`,
      eventId: eventUpcomingBike.id,
    },
    {
      userId: users[0].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.ongoingSport}`,
      eventId: eventOngoingSport.id,
    },
    {
      userId: users[0].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingFarSport}`,
      eventId: eventUpcomingFarSport.id,
    },
    {
      userId: users[1].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.pastHackathon}`,
      eventId: eventPastHackathon.id,
    },
    {
      userId: users[1].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.ongoingTech}`,
      eventId: eventOngoingTech.id,
    },
    {
      userId: users[1].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingReact}`,
      eventId: eventUpcomingReact.id,
    },
    {
      userId: users[1].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingFarTech}`,
      eventId: eventUpcomingFarTech.id,
    },
    {
      userId: users[2].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.pastConcert}`,
      eventId: eventPastConcert.id,
    },
    {
      userId: users[2].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingJazz}`,
      eventId: eventUpcomingJazz.id,
    },
    {
      userId: users[3].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.pastPainting}`,
      eventId: eventPastPainting.id,
    },
    {
      userId: users[3].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingArt}`,
      eventId: eventUpcomingArt.id,
    },
    {
      userId: users[4].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.pastCooking}`,
      eventId: eventPastCooking.id,
    },
    {
      userId: users[4].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingFood}`,
      eventId: eventUpcomingFood.id,
    },
    {
      userId: users[5].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.pastBookclub}`,
      eventId: eventPastBookclub.id,
    },
    {
      userId: users[5].id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `seed_ec_${EVENT_IDS.upcomingBooks}`,
      eventId: eventUpcomingBooks.id,
    },
    // Вступление в клубы
    ...Array.from(
      { length: 30 },
      (_, i): PointsEntry => ({
        userId: users[6 + i].id,
        ruleCode: 'club_join',
        deltaPoints: 3,
        referenceId: `seed_cj_${CLUB_IDS.sport}_${users[6 + i].id}`,
        clubId: clubSport.id,
      }),
    ),
    ...Array.from(
      { length: 30 },
      (_, i): PointsEntry => ({
        userId: users[36 + i].id,
        ruleCode: 'club_join',
        deltaPoints: 3,
        referenceId: `seed_cj_${CLUB_IDS.tech}_${users[36 + i].id}`,
        clubId: clubTech.id,
      }),
    ),
    ...Array.from(
      { length: 20 },
      (_, i): PointsEntry => ({
        userId: users[66 + i].id,
        ruleCode: 'club_join',
        deltaPoints: 3,
        referenceId: `seed_cj_${CLUB_IDS.music}_${users[66 + i].id}`,
        clubId: clubMusic.id,
      }),
    ),
    // Участие в прошедших событиях
    ...Array.from(
      { length: 20 },
      (_, i): PointsEntry => ({
        userId: users[6 + i].id,
        ruleCode: 'event_join',
        deltaPoints: 1,
        referenceId: `seed_ej_${EVENT_IDS.pastRun}_${users[6 + i].id}`,
        eventId: eventPastRun.id,
      }),
    ),
    ...Array.from(
      { length: 30 },
      (_, i): PointsEntry => ({
        userId: users[36 + i].id,
        ruleCode: 'event_join',
        deltaPoints: 1,
        referenceId: `seed_ej_${EVENT_IDS.pastHackathon}_${users[36 + i].id}`,
        eventId: eventPastHackathon.id,
      }),
    ),
    ...Array.from(
      { length: 15 },
      (_, i): PointsEntry => ({
        userId: users[6 + i].id,
        ruleCode: 'event_join',
        deltaPoints: 1,
        referenceId: `seed_ej_${EVENT_IDS.pastYoga}_${users[6 + i].id}`,
        eventId: eventPastYoga.id,
      }),
    ),
    ...Array.from(
      { length: 18 },
      (_, i): PointsEntry => ({
        userId: users[36 + i].id,
        ruleCode: 'event_join',
        deltaPoints: 1,
        referenceId: `seed_ej_${EVENT_IDS.pastReact}_${users[36 + i].id}`,
        eventId: eventPastReact.id,
      }),
    ),
    // Фидбэк после прошедших событий
    ...Array.from(
      { length: 20 },
      (_, i): PointsEntry => ({
        userId: users[6 + i].id,
        ruleCode: 'attendance_feedback',
        deltaPoints: 4,
        referenceId: `seed_af_${EVENT_IDS.pastRun}_${users[6 + i].id}`,
        eventId: eventPastRun.id,
      }),
    ),
    ...Array.from(
      { length: 30 },
      (_, i): PointsEntry => ({
        userId: users[36 + i].id,
        ruleCode: 'attendance_feedback',
        deltaPoints: 4,
        referenceId: `seed_af_${EVENT_IDS.pastHackathon}_${users[36 + i].id}`,
        eventId: eventPastHackathon.id,
      }),
    ),
    ...Array.from(
      { length: 15 },
      (_, i): PointsEntry => ({
        userId: users[6 + i].id,
        ruleCode: 'attendance_feedback',
        deltaPoints: 4,
        referenceId: `seed_af_${EVENT_IDS.pastYoga}_${users[6 + i].id}`,
        eventId: eventPastYoga.id,
      }),
    ),
    ...Array.from(
      { length: 12 },
      (_, i): PointsEntry => ({
        userId: users[36 + i].id,
        ruleCode: 'attendance_feedback',
        deltaPoints: 4,
        referenceId: `seed_af_${EVENT_IDS.pastReact}_${users[36 + i].id}`,
        eventId: eventPastReact.id,
      }),
    ),
    // Бонус за нового участника клуба (клубы sport и tech)
    ...Array.from(
      { length: 10 },
      (_, i): PointsEntry => ({
        userId: users[0].id,
        ruleCode: 'club_new_member_bonus',
        deltaPoints: 1,
        referenceId: `seed_nmb_${CLUB_IDS.sport}_join_${i}`,
        clubId: clubSport.id,
      }),
    ),
    ...Array.from(
      { length: 10 },
      (_, i): PointsEntry => ({
        userId: users[1].id,
        ruleCode: 'club_new_member_bonus',
        deltaPoints: 1,
        referenceId: `seed_nmb_${CLUB_IDS.tech}_join_${i}`,
        clubId: clubTech.id,
      }),
    ),
    // Комментарии (comment_create, +1 автору каждого комментария)
    ...comments.map(
      (c): PointsEntry => ({
        userId: c.authorUserId,
        ruleCode: 'comment_create',
        deltaPoints: 1,
        referenceId: `seed_cmnt_${c.entityType}_${c.entityId}_${c.authorUserId}`,
      }),
    ),
    // Новые подписчики (follower_gained, +2 тому, на кого подписались)
    ...connections.map(
      ([fi, ti]): PointsEntry => ({
        userId: users[ti].id,
        ruleCode: 'follower_gained',
        deltaPoints: 2,
        referenceId: `seed_fg_${users[fi].id}_${users[ti].id}`,
      }),
    ),
    // Первое событие в жизни (first_event_join, +5, один раз на пользователя)
    ...[...new Set(participations.map((p) => p.userId))].map(
      (userId): PointsEntry => ({
        userId,
        ruleCode: 'first_event_join',
        deltaPoints: 5,
        referenceId: `first_event_join_${userId}`,
      }),
    ),
  ];

  await prisma.pointsLedger.createMany({
    data: pointsEntries,
    skipDuplicates: true,
  });

  // ── 11. Уведомления ───────────────────────────────────────────────────────
  const notifications: Array<{
    userId: string;
    type: NotifType;
    title: string;
    body: string;
    targetType?: 'event' | 'club';
    targetId?: string;
  }> = [
    {
      userId: users[0].id,
      type: 'new_follower',
      title: 'Новый подписчик',
      body: 'Demo User 7 подписался на вас',
    },
    {
      userId: users[0].id,
      type: 'new_follower',
      title: 'Новый подписчик',
      body: 'Demo User 8 подписался на вас',
    },
    {
      userId: users[1].id,
      type: 'new_follower',
      title: 'Новый подписчик',
      body: 'Demo User 37 подписался на вас',
    },
    {
      userId: users[1].id,
      type: 'new_follower',
      title: 'Новый подписчик',
      body: 'Demo User 1 подписался на вас',
    },
    {
      userId: users[2].id,
      type: 'new_follower',
      title: 'Новый подписчик',
      body: 'Demo User 67 подписался на вас',
    },
    {
      userId: users[6].id,
      type: 'event_changed',
      title: 'Изменение мероприятия',
      body: 'Велопрогулка — парк Горького: обновлено место встречи',
      targetType: 'event',
      targetId: eventUpcomingBike.id,
    },
    {
      userId: users[36].id,
      type: 'event_changed',
      title: 'Изменение мероприятия',
      body: 'Tech Meetup: NestJS Deep Dive — добавлена ссылка на трансляцию',
      targetType: 'event',
      targetId: eventOngoingTech.id,
    },
    {
      userId: users[36].id,
      type: 'event_changed',
      title: 'Изменение мероприятия',
      body: 'Hackathon Spring 2026 — открыта регистрация команд',
      targetType: 'event',
      targetId: eventUpcomingFarTech.id,
    },
    {
      userId: users[116].id,
      type: 'event_changed',
      title: 'Изменение мероприятия',
      body: 'Дегустация грузинских вин — осталось 3 места',
      targetType: 'event',
      targetId: eventUpcomingFood.id,
    },
  ];

  for (const n of notifications) {
    const exists = await prisma.notification.findFirst({
      where: { userId: n.userId, type: n.type, body: n.body },
    });
    if (!exists) {
      await prisma.notification.create({ data: n });
    }
  }

  // ─── Достижения ──────────────────────────────────────────────────────────
  const achievementsData = [
    {
      code: 'home_alone',
      name: 'Один дома',
      description:
        'Ты создал мероприятие для себя одного. Настоящий интроверт.',
      iconPath: 'achievements/at-home-alone.jpg',
    },
    {
      code: 'wilson',
      name: 'Уилсон',
      description:
        'Ты создал мероприятие, на которое никто не пришёл. Держись, Уилсон!',
      iconPath: 'achievements/willson.jpg',
    },
    {
      code: 'first_avenger',
      name: 'Первый мститель',
      description:
        'Ты первым присоединился к новому мероприятию или вернулся после долгого перерыва.',
      iconPath: 'achievements/captain-america.jpg',
    },
  ];

  for (const a of achievementsData) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      update: { name: a.name, description: a.description },
      create: a,
    });
  }

  console.log(
    'Seed завершён: 250 пользователей, 6 клубов, 22 события (past ×8, ongoing ×2, upcoming ×10, cancelled ×2), ' +
      'участия, подтверждения посещаемости, комментарии, подписки, очки, уведомления, 3 достижения.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
