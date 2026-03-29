import React from 'react';

export const metadata = {
    title: 'Iniciar Sesión | Gestión de Tesis – OGGE – UNFV',
    description: 'Sistema de gestión de tesis para la OGGE UNFV.',
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
        {children}
    </div>
  );
}
