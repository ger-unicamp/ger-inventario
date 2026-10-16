/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O app roda offline-first na rede do laboratorio: nada de telemetria externa.
  poweredByHeader: false,
};

export default nextConfig;
