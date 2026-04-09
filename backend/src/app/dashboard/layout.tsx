import AppBridgeProvider from './app-bridge-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppBridgeProvider>
      {children}
    </AppBridgeProvider>
  );
}
