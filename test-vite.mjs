import { createServer } from 'vite';
import http from 'http';
import express from 'express';

const app = express();
const server = http.createServer(app);

const vite = await createServer({
  server: {
    middlewareMode: true,
    hmr: { server }
  },
  appType: "spa"
});
console.log("Vite created successfully");
process.exit(0);
