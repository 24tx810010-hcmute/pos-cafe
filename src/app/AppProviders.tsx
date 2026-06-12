import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { useMemo, type ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { PortsContext } from "@/ports/portsContext";
import { createAppPortsFromViteEnv } from "./runtimePorts";

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

export function AppProviders({ children }: { children: ReactNode }) {
  const ports = useMemo(() => createAppPortsFromViteEnv(), []);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: false,
          },
        },
      }),
    [],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PortsContext.Provider value={ports}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="bottom-right"
            containerClassName="app-toaster"
            toastOptions={{
              duration: 2400,
              style: {
                borderRadius: 8,
                fontSize: 13,
                maxWidth: "min(360px, calc(100vw - 24px))",
              },
            }}
          />
        </QueryClientProvider>
      </PortsContext.Provider>
    </ThemeProvider>
  );
}
