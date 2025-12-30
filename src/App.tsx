import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { privyConfig } from "./lib/privy-config";
import { wagmiConfig } from "./lib/wagmi-config";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Invoices from "./pages/app/Invoices";
import InvoiceDetail from "./pages/app/InvoiceDetail";
import CreateInvoice from "./pages/app/CreateInvoice";
import Financing from "./pages/app/Financing";
import Vault from "./pages/app/Vault";
import Reputation from "./pages/app/Reputation";
import Proofs from "./pages/app/Proofs";
import Activity from "./pages/app/Activity";
import Settings from "./pages/app/Settings";
import PayInvoice from "./pages/PayInvoice";
import { PrivyErrorHandler } from "./components/PrivyErrorHandler";

const queryClient = new QueryClient();

// Check if Privy app ID is valid
const hasValidPrivyAppId = privyConfig.appId && privyConfig.appId.trim().length > 0;

const AppContent = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/pay/:invoiceId" element={<PayInvoice />} />
                  <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:invoiceId" element={<InvoiceDetail />} />
            <Route path="invoices/new" element={<CreateInvoice />} />
            <Route path="financing" element={<Financing />} />
            <Route path="vault" element={<Vault />} />
            <Route path="reputation" element={<Reputation />} />
            <Route path="proofs" element={<Proofs />} />
            <Route path="activity" element={<Activity />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const App = () => {
  if (hasValidPrivyAppId) {
    return (
      <QueryClientProvider client={queryClient}>
        <PrivyProvider
          appId={privyConfig.appId}
          config={privyConfig.config}
        >
          <PrivyErrorHandler />
          <WagmiProvider config={wagmiConfig}>
            <AppContent />
          </WagmiProvider>
        </PrivyProvider>
      </QueryClientProvider>
    );
  }

  // Fallback: Render without Privy if app ID is missing
  // This allows the app to run in development even without Privy configured
  console.warn('Privy app ID is missing. Some wallet features may not work. Please set VITE_PRIVY_APP_ID in your .env file.');
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
