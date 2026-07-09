import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite cargar los assets de dev cuando entrás por un túnel HTTPS (cloudflared)
  // en lugar de localhost. Sin esto, Next 16 bloquea los chunks y la app no arranca.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
