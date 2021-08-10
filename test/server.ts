import { ENV } from '@/utils/env';
import { app } from '@/server';
import { SuperTest, Test, agent } from 'supertest';
import { Server } from 'http';
import getPort from 'get-port';

export let request: SuperTest<Test>;

export let server: Server;

const start = async () => {
  server = app.listen(await getPort(), ENV.HOST);
  request = agent(server);
};

const close = async () => {
  server.close();
};

beforeAll(async () => {
  await start();
  request = agent(server);
});

// * Code that is executed after any jest test file that imports this file
afterAll(async () => {
  await close();
});
