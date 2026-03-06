// app/provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ThirdwebProvider } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { Toaster } from "sonner";
import { arbitrum, bsc, polygon } from "thirdweb/chains";

export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 5 * 60_000, refetchOnWindowFocus: false },
          mutations: { retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThirdwebProvider client={thirdwebClient} supportedChains={[bsc, arbitrum, polygon]}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            expand
            duration={6000}
            toastOptions={{ classNames: { toast: "z-[99999]" } }}
          />
        </ThemeProvider>
      </ThirdwebProvider>
    </QueryClientProvider>
  );
}
