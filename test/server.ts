import { app } from '@/app';
import supertest from 'supertest';

const request = supertest(app);

export { request };
