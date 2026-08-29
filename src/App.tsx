import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SocketProvider, useSocketData } from "./contexts/SocketProvider";
import RealTimePage from "./pages/main";
import { AuthorizeGate } from "./components/AuthorizeGate";

const queryClient = new QueryClient();

// Decides what to render from the connection state so the user is never left
// with a blank or broken screen and no explanation.
function ConnectionGate() {
  const { connection, errorMessage } = useSocketData();

  if (connection === "unauthorized") {
    return <AuthorizeGate reason="unauthorized" />;
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
  return <RealTimePage />;
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
