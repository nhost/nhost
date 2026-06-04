diff --git a/src/services/postgres/index.ts b/src/services/postgres/index.ts
index 1234567..89abcdef 100644
--- a/src/services/postgres/index.ts
+++ b/src/services/postgres/index.ts
@@ -1,10 +1,10 @@
 import { Client } from 'pg';
 import { config } from 'dotenv';

 config();

 const client = new Client({
-  host: process.env.POSTGRES_HOST,
-  port: parseInt(process.env.POSTGRES_PORT, 10),
-  database: process.env.POSTGRES_DB,
-  user: process.env.POSTGRES_USER,
-  password: process.env.POSTGRES_PASSWORD
+  host: process.env.POSTGRES_HOST,
+  port: parseInt(process.env.POSTGRES_PORT, 10),
+  database: process.env.POSTGRES_DB,
+  user: process.env.POSTGRES_USER,
+  password: process.env.POSTGRES_PASSWORD
 });

 client.connect().then(() => {
   console.log('Connected to PostgreSQL');
 }).catch((err) => {
   console.error('Error connecting to PostgreSQL', err);
 });