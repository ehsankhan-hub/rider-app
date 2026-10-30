import 'reflect-metadata';
import http from 'http';
import { Server } from 'socket.io';

import jwt from 'jsonwebtoken';
import { createApp } from './app';
import { sequelize } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { RideEvents } from './sockets/ride-events';

async function bootstrap(): Promise<void> {
  await sequelize.authenticate();
  const rideEvents = new RideEvents();
  const app = createApp(rideEvents);
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true } });
  const nsp = io.of('/trips');

  nsp.use((socket, next) => {
    const token = String(socket.handshake.auth?.token ?? '');
    try {
      const payload = jwt.verify(token, env.jwtAccessSecret) as { sub: string };
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  nsp.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  rideEvents.attach(nsp);

  server.listen(env.port, () => {
    logger.info({ port: env.port }, 'Ride API listening');
  });
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Ride API failed to start');
  process.exit(1);
});
