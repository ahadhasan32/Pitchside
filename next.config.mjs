import { fileURLToPath } from 'node:url';
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
  images: { unoptimized: true },
  // Reference material (private data) must never be traced into the bundle.
  outputFileTracingExcludes: { '*': ['wintershowdown/**', 'reference/**', 'scripts/**'] },
};
export default nextConfig;
