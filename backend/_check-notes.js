const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const exp = await p.experiment.findFirst({ where: { status: 'RUNNING' } });
  const notes = exp.notes || {};
  console.log('All notes:', JSON.stringify(notes, null, 2));

  // Simulate the API calculation
  const observedPurchaseRate = 0.03; // fallback since 0 orders

  // New formula from thompson.ts
  const p1 = Math.max(0.005, Math.min(observedPurchaseRate, 0.50));
  const relativeMDE = p1 < 0.05 ? 0.75 : p1 < 0.10 ? 0.60 : 0.50;
  const p2 = p1 * (1 + relativeMDE);
  const zSum = 1.645 + 0.84;
  const zSumSq = zSum * zSum;
  const numerator = zSumSq * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = (p2 - p1) * (p2 - p1);
  let nPerVariant = Math.ceil(numerator / denominator);
  nPerVariant = Math.max(200, Math.min(nPerVariant, 8000));
  console.log('\nnPerVariant (new formula):', nPerVariant);

  // Consistency multiplier
  const dailyLeaders = notes.dailyLeaders || [];
  console.log('dailyLeaders length:', dailyLeaders.length);

  // Calculate consistency like the code does
  let multiplier = 1.0;
  if (dailyLeaders.length >= 3) {
    const recent = dailyLeaders.slice(-7);
    const leaders = recent.map(d => d.leader);
    const mostCommon = leaders.sort((a,b) => leaders.filter(v=>v===b).length - leaders.filter(v=>v===a).length)[0];
    const agreePct = leaders.filter(l => l === mostCommon).length / leaders.length;
    multiplier = agreePct >= 0.85 ? 0.85 : agreePct >= 0.70 ? 1.0 : 1.15;
  }
  console.log('consistency multiplier:', multiplier);

  const adjustedTargetPerVariant = Math.ceil(nPerVariant * multiplier);
  console.log('adjustedTargetPerVariant:', adjustedTargetPerVariant);

  const targetOrdersPerVariant = Math.max(25, Math.ceil(nPerVariant * Math.max(0.005, observedPurchaseRate)));
  console.log('targetOrdersPerVariant (before consistency):', targetOrdersPerVariant);

  const adjustedOrderTarget = Math.ceil(targetOrdersPerVariant * multiplier);
  console.log('adjustedOrderTarget (after consistency):', adjustedOrderTarget);
  console.log('\n=== DASHBOARD SHOWS ===');
  console.log('Orders needed total:', adjustedOrderTarget * 2);

  // Check: what does the OLD deployed code calculate?
  // OLD formula: relativeMDE = 0.50 always
  const oldP2 = p1 * 1.5;
  const oldNumerator = zSumSq * (p1 * (1 - p1) + oldP2 * (1 - p1));
  const oldDenominator = (oldP2 - p1) * (oldP2 - p1);
  let oldNPerVariant = Math.ceil(zSumSq * (p1*(1-p1) + oldP2*(1-oldP2)) / ((oldP2-p1)*(oldP2-p1)));
  oldNPerVariant = Math.max(500, Math.min(oldNPerVariant, 20000));
  console.log('\nOLD nPerVariant (for comparison):', oldNPerVariant);
  const oldOrders = Math.max(25, Math.ceil(oldNPerVariant * 0.03));
  console.log('OLD orders per variant:', oldOrders);
  console.log('OLD orders total:', oldOrders * 2);

  // Check if sampleTargetPerVariant in notes is from old cron
  console.log('\nDB sampleTargetPerVariant:', notes.sampleTargetPerVariant);
  console.log('DB baselinePurchaseRate:', notes.baselinePurchaseRate);

  await p.$disconnect();
})();
