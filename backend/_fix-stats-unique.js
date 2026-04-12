const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/stores/[id]/stats/route.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Fix total counts to use unique sessions
const oldTotals = `  const totalSessions = await prisma.visitorSession.count({ where: { storeId: store.id } });
  const totalEvents = await prisma.event.count({ where: { storeId: store.id } });
  const totalCartOpens = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CART_OPENED' },
  });
  const totalCheckouts = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED' },
  });
  const totalOrders = await prisma.event.count({
    where: { storeId: store.id, eventType: 'ORDER_COMPLETED' },
  });`;

const newTotals = `  const totalSessions = await prisma.visitorSession.count({ where: { storeId: store.id } });
  const totalEvents = await prisma.event.count({ where: { storeId: store.id } });
  // Unique sessions per event type — 1 user = 1 count regardless of repeat opens
  const totalCartOpens = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CART_OPENED' },
  })).length;
  const totalCheckouts = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED' },
  })).length;
  const totalOrders = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'ORDER_COMPLETED' },
  })).length;`;

if (!code.includes(oldTotals)) {
  console.error('ERROR: Could not find total counts');
  process.exit(1);
}
code = code.replace(oldTotals, newTotals);

// Fix recent counts too
const oldRecent = `  const recentCartOpens = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
  });
  const recentCheckouts = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED', createdAt: { gte: sevenDaysAgo } },
  });`;

const newRecent = `  const recentCartOpens = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CART_OPENED', createdAt: { gte: sevenDaysAgo } },
  })).length;
  const recentCheckouts = (await prisma.event.groupBy({
    by: ['sessionId'],
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED', createdAt: { gte: sevenDaysAgo } },
  })).length;`;

if (!code.includes(oldRecent)) {
  console.error('ERROR: Could not find recent counts');
  process.exit(1);
}
code = code.replace(oldRecent, newRecent);

fs.writeFileSync(filePath, code, 'utf8');
console.log('SUCCESS: Stats API now counts unique sessions');
