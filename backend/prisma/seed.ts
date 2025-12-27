import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create machines
  const machines = [
    { machineCode: '50H-2', name: 'プレス機 50H-2号機', isActive: true },
    { machineCode: '100T-1', name: '射出成形機 100T-1号機', isActive: true },
    { machineCode: 'CNC-3', name: 'CNC旋盤 3号機', isActive: true },
    { machineCode: 'AS-5', name: '組立ライン 5号機', isActive: true },
  ];

  for (const machine of machines) {
    const created = await prisma.machine.upsert({
      where: { machineCode: machine.machineCode },
      update: {},
      create: machine,
    });
    console.log(`Created machine: ${created.name} (${created.machineCode})`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
