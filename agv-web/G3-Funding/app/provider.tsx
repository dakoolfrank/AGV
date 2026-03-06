// app/provider.tsx
"use client";

import { Toaster } from "sonner";
import { ThirdwebProvider } from "@/components/wallet/ThirdwebProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        expand
        duration={6000}
        toastOptions={{ classNames: { toast: "z-[99999]" } }}
      />
    </ThirdwebProvider>
  );
}
