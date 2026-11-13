import { config } from 'dotenv';
config({ path: '.env.local' });
config();
export function need(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var ${name} (set it in .env.local)`); process.exit(1); }
  return v;
}
