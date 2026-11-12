import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MachineProvider, useMachine } from "./contexts/MachineProvider";
import { ProfileSelectionProvider } from "./components/profiles/ProfileSelection";
import { ThemeProvider } from "./theme";
import { ToastProvider } from "./components/ui/Toast";
import { Header } from "./components/layout/Header";
import { ConnectionBanner } from "./components/layout/ConnectionBanner";
import { ConnectGate } from "./components/connection/ConnectGate";
import { Spinner } from "./components/ui/Spinner";
import { MachinePage } from "./pages/MachinePage";
import { useRoute } from "./hooks/useRoute";

const SensorsPage = lazy(() => import("./pages/SensorsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const PageSpinner = () => (
  <div className="flex justify-center py-24 text-ink-3">
    <Spinner className="size-6" />
  </div>
);

const Shell = () => {
  const { tab, section, navigate } = useRoute();
  const { connection, checkingAccess } = useMachine();

  // Each tab opens at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header tab={tab} onNavigate={navigate} />
      <ConnectionBanner />
      <main className="flex-1">
        {/* Without access the pages would only collect refusals, so they
            don't mount (and don't poll) until the machine allows this
            browser. */}
        {connection === "unauthorized" ? (
          <ConnectGate />
        ) : checkingAccess ? (
          <PageSpinner />
        ) : (
          <Suspense fallback={<PageSpinner />}>
            {tab === "machine" && <MachinePage />}
            {tab === "sensors" && <SensorsPage />}
            {tab === "settings" && (
              <SettingsPage
                section={section}
                onSection={(id) => navigate("settings", id)}
              />
            )}
          </Suspense>
        )}
      </main>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <MachineProvider>
            <ProfileSelectionProvider>
              <Shell />
            </ProfileSelectionProvider>
          </MachineProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
