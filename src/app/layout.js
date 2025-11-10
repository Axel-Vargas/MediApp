"use client";

import { UserProvider } from "@/context/userContext";
import "@/globals.css";


export default function RootLayout({ children }) {
  return (
    <html lang="es" translate="no" suppressHydrationWarning>
      <head>
        <title>MediApp - Monitoreo de Medicamentos</title>
        <meta name="description" content="Aplicación para gestión de medicamentos y recordatorios" />
        <link rel="icon" href="/icono.png" type="image/png" />
        <link rel="shortcut icon" href="/icono.png" type="image/png" />
      </head>
      <body translate="no" suppressHydrationWarning>
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}