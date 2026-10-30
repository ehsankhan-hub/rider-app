import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { env } from './env';

async function migrate(): Promise<void> {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    multipleStatements: true,
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const dir = path.resolve(__dirname, '../../migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const [rows] = await connection.query(
      'SELECT id FROM schema_migrations WHERE filename = ?',
      [file],
    );
    if (Array.isArray(rows) && rows.length > 0) {
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await connection.query(sql);
    await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    console.log(`Applied ${file}`);
  }

  await connection.end();
}

migrate()
  .then(() => {
    console.log('Auth migrations complete');
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
