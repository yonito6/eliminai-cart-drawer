'use client';

import {
  Page,
  Layout,
  Card,
  Text,
  ProgressBar,
  Badge,
  BlockStack,
  InlineStack,
  Divider,
} from '@shopify/polaris';

interface Props {
  store: { name: string; domain: string; baseline: number | null };
  todayMetrics: { cartOpens: number; checkoutClicks: number };
  activeExperiment: {
    name: string;
    status: string;
    confidence: number;
    liftPercent: number | null;
    trafficSplit: Record<string, number>;
    startedAt: string;
    variants: { id: string; label: string; cartOpens: number; checkoutClicks: number; rate: string }[];
  } | null;
  completedExperiments: {
    name: string;
    status: string;
    confidence: number;
    liftPercent: number | null;
    winnerVariantId: string | null;
    startedAt: string;
    endedAt: string | undefined;
  }[];
}

export function DashboardClient({ store, todayMetrics, activeExperiment, completedExperiments }: Props) {
  const clickRate = todayMetrics.cartOpens > 0
    ? ((todayMetrics.checkoutClicks / todayMetrics.cartOpens) * 100).toFixed(1)
    : '0.0';

  const daysRunning = activeExperiment
    ? Math.floor((Date.now() - new Date(activeExperiment.startedAt).getTime()) / 86400000)
    : 0;

  return (
    <Page title="Cart Optimizer">
      <Layout>
        {/* Today's Metrics */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Today</Text>
              <InlineStack gap="800">
                <BlockStack>
                  <Text variant="headingLg" as="p">{todayMetrics.cartOpens}</Text>
                  <Text as="p" tone="subdued">Cart Opens</Text>
                </BlockStack>
                <BlockStack>
                  <Text variant="headingLg" as="p">{todayMetrics.checkoutClicks}</Text>
                  <Text as="p" tone="subdued">Checkout Clicks</Text>
                </BlockStack>
                <BlockStack>
                  <Text variant="headingLg" as="p">{clickRate}%</Text>
                  <Text as="p" tone="subdued">Click Rate</Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Active Test */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  {activeExperiment ? activeExperiment.name : 'No Active Test'}
                </Text>
                {activeExperiment && (
                  <Badge tone="info">{`Running · Day ${daysRunning}`}</Badge>
                )}
                {!activeExperiment && store.baseline === null && (
                  <Badge tone="attention">Collecting Baseline</Badge>
                )}
              </InlineStack>

              {activeExperiment && (
                <>
                  {activeExperiment.variants.map(v => (
                    <InlineStack key={v.id} align="space-between">
                      <Text as="p">{v.label}</Text>
                      <Text as="p" fontWeight="bold">
                        {v.rate}% ({v.cartOpens} opens, {v.checkoutClicks} clicks)
                      </Text>
                    </InlineStack>
                  ))}

                  <Divider />

                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p">Confidence</Text>
                      <Text as="p" fontWeight="bold">
                        {(activeExperiment.confidence * 100).toFixed(0)}% / 95%
                      </Text>
                    </InlineStack>
                    <ProgressBar progress={activeExperiment.confidence * 100} size="small" />
                  </BlockStack>

                  <InlineStack align="space-between">
                    <Text as="p" tone="subdued">Traffic Split</Text>
                    <Text as="p" tone="subdued">
                      {Object.entries(activeExperiment.trafficSplit)
                        .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
                        .join(' / ')}
                    </Text>
                  </InlineStack>
                </>
              )}

              {!activeExperiment && store.baseline === null && (
                <Text as="p" tone="subdued">
                  We are measuring your baseline checkout rate. The first A/B test will start automatically once we have enough data.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Completed Tests */}
        {completedExperiments.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Completed Tests</Text>
                {completedExperiments.map((exp, i) => (
                  <Card key={i}>
                    <InlineStack align="space-between">
                      <BlockStack>
                        <Text as="p" fontWeight="bold">{exp.name}</Text>
                        <Text as="p" tone="subdued">
                          {exp.status === 'WINNER_FOUND' && `Winner: +${exp.liftPercent?.toFixed(1)}% lift`}
                          {exp.status === 'NO_DIFFERENCE' && 'No significant difference'}
                          {exp.status === 'REVERTED' && 'Auto-reverted (performance drop)'}
                        </Text>
                      </BlockStack>
                      <Badge tone={
                        exp.status === 'WINNER_FOUND' ? 'success' :
                        exp.status === 'REVERTED' ? 'critical' : 'info'
                      }>
                        {exp.status === 'WINNER_FOUND' ? 'Winner' :
                         exp.status === 'REVERTED' ? 'Reverted' : 'No Diff'}
                      </Badge>
                    </InlineStack>
                  </Card>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
