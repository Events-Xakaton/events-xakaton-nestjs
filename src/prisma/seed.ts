import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const now = Date.now();
  const tgBase = 880000000n;
  const totalUsers = 250;

  const roles = ['Member', 'ClubAdmin', 'PlatformAdmin'] as const;
  for (const code of roles) {
    await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  const users: Array<{ id: string; telegramUserId: bigint }> = [];
  for (let i = 1; i <= totalUsers; i += 1) {
    const telegramUserId = tgBase + BigInt(i);
    const user = await prisma.user.upsert({
      where: { telegramUserId },
      update: {},
      create: {
        telegramUserId,
        fullName: `Demo User ${i}`,
        isVerified: true,
      },
      select: { id: true, telegramUserId: true },
    });
    users.push(user);

    const memberRole = await prisma.role.findUnique({
      where: { code: 'Member' },
      select: { id: true },
    });
    if (memberRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: memberRole.id } },
        update: {},
        create: { userId: user.id, roleId: memberRole.id },
      });
    }
  }

  const platformAdminRole = await prisma.role.findUnique({
    where: { code: 'PlatformAdmin' },
    select: { id: true },
  });
  if (platformAdminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: users[0].id, roleId: platformAdminRole.id },
      },
      update: {},
      create: { userId: users[0].id, roleId: platformAdminRole.id },
    });
  }

  const club = await prisma.club.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      creatorUserId: users[0].id,
      title: 'Demo Sport Club',
      description: 'Weekly sport activities',
      categoryCode: 'Спорт',
    },
  });

  for (let i = 0; i < 20; i += 1) {
    await prisma.clubMembership.upsert({
      where: { clubId_userId: { clubId: club.id, userId: users[i].id } },
      update: { status: 'joined', role: i === 0 ? 'owner' : 'member' },
      create: {
        clubId: club.id,
        userId: users[i].id,
        status: 'joined',
        role: i === 0 ? 'owner' : 'member',
      },
    });
  }

  const eventA = await prisma.event.upsert({
    where: { id: '00000000-0000-0000-0000-000000000201' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000201',
      clubId: club.id,
      creatorUserId: users[0].id,
      title: 'Morning Run',
      description: 'Easy pace run in the park',
      locationOrLink: 'City Park',
      startsAtUtc: new Date(now + 2 * 60 * 60 * 1000),
      endsAtUtc: new Date(now + 3 * 60 * 60 * 1000),
      status: 'upcoming',
    },
  });

  const eventB = await prisma.event.upsert({
    where: { id: '00000000-0000-0000-0000-000000000202' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000202',
      creatorUserId: users[1].id,
      title: 'Lunch & Learn',
      description: 'Short internal talk',
      locationOrLink: 'Meeting Room A',
      startsAtUtc: new Date(now + 4 * 60 * 60 * 1000),
      endsAtUtc: new Date(now + 5 * 60 * 60 * 1000),
      status: 'upcoming',
    },
  });

  for (let i = 1; i < 40; i += 1) {
    await prisma.eventParticipation.upsert({
      where: { eventId_userId: { eventId: eventA.id, userId: users[i].id } },
      update: { status: 'joined' },
      create: { eventId: eventA.id, userId: users[i].id, status: 'joined' },
    });
  }

  await prisma.pointsLedger.createMany({
    data: [
      {
        userId: users[0].id,
        ruleCode: 'club_create',
        deltaPoints: 10,
        referenceId: `seed_club_create_${club.id}`,
        clubId: club.id,
      },
      {
        userId: users[0].id,
        ruleCode: 'event_create',
        deltaPoints: 8,
        referenceId: `seed_event_create_${eventA.id}`,
        eventId: eventA.id,
      },
      {
        userId: users[1].id,
        ruleCode: 'event_create',
        deltaPoints: 8,
        referenceId: `seed_event_create_${eventB.id}`,
        eventId: eventB.id,
      },
      {
        userId: users[2].id,
        ruleCode: 'club_join',
        deltaPoints: 3,
        referenceId: `seed_club_join_${club.id}_${users[2].id}`,
        clubId: club.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log(
    'Seed completed: users, roles, club, events, memberships, points.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
