"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type FC, type ReactNode } from "react";

type AppProvidersProps = {
  children: ReactNode;
};

export const AppProviders: FC<AppProvidersProps> = ({ children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
