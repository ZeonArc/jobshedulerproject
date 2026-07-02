import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

let io: SocketIOServer;

export const initSocket = (server: http.Server) => {
  io = new SocketIOServer(server, {
    cors: { origin: '*' }
  });
  
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized');
  }
  return io;
};
