import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

function loadRootEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate) && fs.existsSync(path.join(dir, 'docker-compose.yml'))) {
      const parsed = dotenv.parse(fs.readFileSync(candidate));
      for (const [key, value] of Object.entries(parsed)) {
        const current = process.env[key];
        const missing = current === undefined || current === '' || current.startsWith('change_me_') || current.startsWith('replace_with_');
        if (missing) process.env[key] = value;
      }
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

function secret(name: string): string {
  const value = process.env[name] ?? '';
  if (value.length < 32 || value.startsWith('change_me_') || value.startsWith('replace_with_')) {
    throw new Error(`${name} must be a random value of at least 32 characters`);
  }
  return value;
}

loadRootEnv();

export const env = {
  port: Number(process.env.AUTH_PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  db: {
    host: process.env.MYSQL_HOST ?? 'mysql',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    name: process.env.AUTH_DB_NAME ?? 'auth_db',
    user: process.env.MYSQL_USER ?? 'rider',
    password: process.env.MYSQL_PASSWORD ?? 'rider_pass_change_me',
  },
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },
};
