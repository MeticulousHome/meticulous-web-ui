import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SocketProvider, useSocketData } from "./contexts/SocketProvider";
import RealTimePage from "./pages/main";
import { AuthorizeGate } from "./components/AuthorizeGate";

const queryClient = new QueryClient();

// Decides what to render from the connection state so the user is never left
// with a blank or broken screen and no explanation.
function ConnectionGate() {
  const { connection, errorMessage, legacyMachine } = useSocketData();

  if (connection === "unauthorized") {
    return <AuthorizeGate reason="unauthorized" />;
  }
  if (connection === "identity_changed") {
    return <AuthorizeGate reason="identity_changed" />;
  }
  if (connection === "error") {
    return <AuthorizeGate reason="error" />;
  }
  if (connection === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <p role="status">
          Connecting to your machine{errorMessage ? `: ${errorMessage}` : "..."}
        </p>
      </div>
    );
  }
  return (
    <>
      {legacyMachine && (
        <div
          role="status"
          className="fixed top-0 inset-x-0 z-50 bg-amber-900 px-4 py-2 text-center text-sm text-white"
        >
          This machine needs a software update to secure the connection. No
          saved authorization is being sent.
        </div>
      )}
      <RealTimePage />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <ConnectionGate />
      </SocketProvider>
    </QueryClientProvider>
  );
}

export default App;
