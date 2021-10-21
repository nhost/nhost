import { app } from '@/server';
import supertest from 'supertest';

const request = supertest(app);

export { request };
