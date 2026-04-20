// Simulate the NEW calculateSampleTarget inline
function calculateSampleTarget(baselineRate, numVariants = 2) {
  const p1 = Math.max(0.005, Math.min(baselineRate, 0.50));
  const relativeMDE = p1 < 0.05 ? 0.75 : p1 < 0.10 ? 0.60 : 0.50;
  const p2 = p1 * (1 + relativeMDE);
  const zSum = 1.645 + 0.84;
  const zSumSq = zSum * zSum;
  const numerator = zSumSq * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = (p2 - p1) * (p2 - p1);
  let nPerVariant = Math.ceil(numerator / denominator);
  nPerVariant = Math.max(200, Math.min(nPerVariant, 8000));
  return { nPerVariant, totalNeeded: nPerVariant * numVariants, baselineRate: p1 };
}

const observedPurchaseRate = 0.03;
const sampleTarget = calculateSampleTarget(observedPurchaseRate, 2);
console.log('nPerVariant:', sampleTarget.nPerVariant);

const multiplier = 1.0;
const adjustedTargetPerVariant = Math.ceil(sampleTarget.nPerVariant * multiplier);
console.log('adjustedTargetPerVariant (API sends as sampleTargetPerVariant):', adjustedTargetPerVariant);

// API line 76 — BUT still has old min of 25, not 15
const targetOrdersPerVariant = Math.max(25, Math.ceil(sampleTarget.nPerVariant * Math.max(0.005, observedPurchaseRate)));
const adjustedOrderTarget = Math.ceil(targetOrdersPerVariant * multiplier);
console.log('adjustedOrderTarget (API sends as minOrdersPerVariant):', adjustedOrderTarget);

// Dashboard line 2092
const minOrdersPerVariant = adjustedOrderTarget;
const sampleTargetPerVar = adjustedTargetPerVariant;
const baselinePurchaseRate = observedPurchaseRate;
const dynamicOrdersPerVariant = Math.max(minOrdersPerVariant, Math.ceil(sampleTargetPerVar * baselinePurchaseRate));
const dynamicOrdersTotal = dynamicOrdersPerVariant * 2;

console.log('\nDashboard shows:');
console.log('dynamicOrdersPerVariant:', dynamicOrdersPerVariant);
console.log('dynamicOrdersTotal:', dynamicOrdersTotal);
