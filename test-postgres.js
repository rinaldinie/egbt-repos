const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    }
  }
});

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully!');

    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);

    const gameCount = await prisma.notifiedGame.count();
    console.log(`🎮 Notified games: ${gameCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
