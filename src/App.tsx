import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SocketProvider } from "./contexts/SocketProvider";
import RealTimePage from "./pages/main";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <RealTimePage />
      </SocketProvider>
    </QueryClientProvider>
  );
}

export default App;
