import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** Color de la barra del navegador en móvil (coincide con --bg del tema oscuro). */
export const viewport: Viewport = {
  themeColor: "#07080d",
};

export const metadata: Metadata = {
  title: "Content OS",
  description:
    "Centro de mando de contenido e Instagram multi-cuenta: métricas, pipeline, calendario y generador.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes de pintar, para no parpadear. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='light'||t==='glass'||t==='aero')document.documentElement.setAttribute('data-theme',t);}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
