import { StoreProvider } from "@/lib/store-context";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  );
}
