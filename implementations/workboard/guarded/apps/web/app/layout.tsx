import type { FC, ReactNode } from "react";
import { APP_NAME } from "@workboard/shared";
import { AppProviders } from "../src/providers";
import "./globals.css";

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout: FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <AppProviders>
          <main id="main">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
};

export const metadata = {
  title: APP_NAME,
};

export default RootLayout;
