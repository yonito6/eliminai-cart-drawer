'use client';

import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider i18n={enTranslations}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px' }}>
        {children}
      </div>
    </AppProvider>
  );
}
