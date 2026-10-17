import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { useMemo, type ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { PortsContext } from "@/features/shared/portsContext";
import { createAppPortsFromViteEnv } from "./runtimePorts";
import { WriteLifecycle } from "./WriteLifecycle";
import { requireCompatibilityUpdate } from "./compatibilityGate";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0F766E",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
});

export const createCompatibilityQueryClient = () => new QueryClient({
  queryCache: new QueryCache({ onError: requireCompatibilityUpdate }),
  mutationCache: new MutationCache({ onError: requireCompatibilityUpdate }),
  defaultOptions: {
    mutations: { retry: false, networkMode: "always" },
    queries: { staleTime: 30_000, retry: false },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const ports = useMemo(() => createAppPortsFromViteEnv(), []);
  const queryClient = useMemo(createCompatibilityQueryClient, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PortsContext.Provider value={ports}>
        <QueryClientProvider client={queryClient}>
          <WriteLifecycle />
          {children}
          <Toaster
            position="bottom-right"
            containerClassName="!bottom-3 !right-3 max-w-[calc(100vw-24px)] max-sm:!bottom-2.5 max-sm:!right-2.5 max-sm:max-w-[calc(100vw-20px)]"
            toastOptions={{
              duration: 2400,
              className: "max-w-[min(360px,calc(100vw-24px))] rounded-pos text-[13px] shadow-[0_14px_36px_rgb(15_23_42_/_18%)]",
            }}
          />
        </QueryClientProvider>
      </PortsContext.Provider>
    </ThemeProvider>
  );
}
