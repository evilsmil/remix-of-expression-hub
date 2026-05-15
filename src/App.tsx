import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import Administration from "./pages/Administration";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Historique from "./pages/Historique";
import Validation from "./pages/Validation";
import FebCreate from "./pages/FebCreate";
import FebDetail from "./pages/FebDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Signature from "./pages/Signature";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <RequireAuth>
    <AppLayout>{children}</AppLayout>
  </RequireAuth>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/inscription" element={<Register />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
          <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/historique" element={<Protected><Historique /></Protected>} />
          <Route path="/validation" element={<Protected><Validation /></Protected>} />
          <Route path="/febs/nouveau" element={<Protected><FebCreate /></Protected>} />
          <Route path="/febs/:id" element={<Protected><FebDetail /></Protected>} />
          <Route path="/signature" element={<Protected><Signature /></Protected>} />
          <Route path="/administration" element={<Protected><Administration /></Protected>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
