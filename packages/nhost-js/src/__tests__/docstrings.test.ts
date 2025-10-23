import { expect, test } from "@jest/globals";
import {
  createClient,
  createNhostClient,
  withAdminSession,
} from "@nhost/nhost-js";

const subdomain = "local";
const region = "local";

test("mainExample", async () => {
  const email = `test-${Date.now()}@example.com`;
  const password = "password123";

  const nhost = createClient({
    subdomain,
    region,
  });

  // Sign in with email/password
  // This will create a session and persist it in the storage
  // Subsequent calls will use the session from the storage
  // If the session is about to expire, it will be refreshed
  // automatically
  await nhost.auth.signUpEmailPassword({
    email,
    password,
  });

  // upload a couple of files
  const uplFilesResp = await nhost.storage.uploadFiles({
    "file[]": [
      new File(["test1"], "file-1", { type: "text/plain" }),
      new File(["test2 is larger"], "file-2", { type: "text/plain" }),
    ],
  });
  console.log(JSON.stringify(uplFilesResp, null, 2));
  // {
  //   "data": {
  //     "processedFiles": [
  //       {
  //         "id": "c0e83185-0ce5-435c-bd46-9841adc30699",
  //         "name": "file-1",
  //         "size": 5,
  //         "bucketId": "default",
  //         "etag": "\"5a105e8b9d40e1329780d62ea2265d8a\"",
  //         "createdAt": "2025-05-09T17:26:04.579839+00:00",
  //         "updatedAt": "2025-05-09T17:26:04.589692+00:00",
  //         "isUploaded": true,
  //         "mimeType": "text/plain",
  //         "uploadedByUserId": "3357aada-b6c7-4af1-9655-1307ca2883a2",
  //         "metadata": null
  //       },
  //       {
  //         "id": "3f189004-21fd-42d0-be1d-1ead021ab167",
  //         "name": "file-2",
  //         "size": 15,
  //         "bucketId": "default",
  //         "etag": "\"302e888c5e289fe6b02115b748771ee9\"",
  //         "createdAt": "2025-05-09T17:26:04.59245+00:00",
  //         "updatedAt": "2025-05-09T17:26:04.596831+00:00",
  //         "isUploaded": true,
  //         "mimeType": "text/plain",
  //         "uploadedByUserId": "3357aada-b6c7-4af1-9655-1307ca2883a2",
  //         "metadata": null
  //       }
  //     ]
  //   },
  //   "status": 201,
  //   "headers": {
  //     "content-length": "644",
  //     "content-type": "application/json; charset=utf-8",
  //     "date": "Fri, 09 May 2025 17:26:04 GMT"
  //   }
  // }

  // make a GraphQL request to list the files
  const graphResp = await nhost.graphql.request({
    query: `
     query {
       files {
         name
         size
         mimeType
       }
     }
   `,
  });

  console.log(JSON.stringify(graphResp, null, 2));
  // {
  //   "body": {
  //     "data": {
  //       "files": [
  //         {
  //           "name": "file-1",
  //           "size": 5,
  //           "mimeType": "text/plain"
  //         },
  //         {
  //           "name": "file-2",
  //           "size": 15,
  //           "mimeType": "text/plain"
  //         }
  //       ]
  //     }
  //   },
  //   "status": 200,
  //   "headers": {}
  // }

  // make a request to a serverless function
  const funcResp = await nhost.functions.post("/helloworld", {
    message: "Hello, World!",
  });
  console.log(JSON.stringify(funcResp.body, null, 2));
  // {
  //   "message": "Hello, World!"
  // }

  expect(uplFilesResp.status).toBe(201);

  expect(graphResp.status).toBe(200);
  expect(graphResp.body.errors).toBeUndefined();
  expect(graphResp.body.data).toStrictEqual({
    files: [
      {
        name: "file-1",
        size: 5,
        mimeType: "text/plain",
      },
      {
        name: "file-2",
        size: 15,
        mimeType: "text/plain",
      },
    ],
  });
});

test("adminClient", async () => {
  const nhost = createNhostClient({
    subdomain,
    region,
    configure: [
      withAdminSession({
        adminSecret: "nhost-admin-secret",
        role: "user",
        sessionVariables: {
          "user-id": "54058C42-51F7-4B37-8B69-C89A841D2221",
        },
      }),
    ],
  });

  // upload a couple of files
  const uplFilesResp = await nhost.storage.uploadFiles({
    "file[]": [
      new File(["test1"], "file-1", { type: "text/plain" }),
      new File(["test2 is larger"], "file-2", { type: "text/plain" }),
    ],
  });
  console.log(JSON.stringify(uplFilesResp, null, 2));
  // {
  //   "data": {
  //     "processedFiles": [
  //       {
  //         "id": "c0e83185-0ce5-435c-bd46-9841adc30699",
  //         "name": "file-1",
  //         "size": 5,
  //         "bucketId": "default",
  //         "etag": "\"5a105e8b9d40e1329780d62ea2265d8a\"",
  //         "createdAt": "2025-05-09T17:26:04.579839+00:00",
  //         "updatedAt": "2025-05-09T17:26:04.589692+00:00",
  //         "isUploaded": true,
  //         "mimeType": "text/plain",
  //         "uploadedByUserId": "54058c42-51f7-4b37-8b69-c89a841d2221",
  //         "metadata": null
  //       },
  //       {
  //         "id": "3f189004-21fd-42d0-be1d-1ead021ab167",
  //         "name": "file-2",
  //         "size": 15,
  //         "bucketId": "default",
  //         "etag": "\"302e888c5e289fe6b02115b748771ee9\"",
  //         "createdAt": "2025-05-09T17:26:04.59245+00:00",
  //         "updatedAt": "2025-05-09T17:26:04.596831+00:00",
  //         "isUploaded": true,
  //         "mimeType": "text/plain",
  //         "uploadedByUserId": "54058c42-51f7-4b37-8b69-c89a841d2221",
  //         "metadata": null
  //       }
  //     ]
  //   },
  //   "status": 201,
  //   "headers": {
  //     "content-length": "644",
  //     "content-type": "application/json; charset=utf-8",
  //     "date": "Fri, 09 May 2025 17:26:04 GMT"
  //   }
  // }

  // make a GraphQL request to list the files
  const graphResp = await nhost.graphql.request({
    query: `
     query {
       files {
         name
         size
         mimeType
       }
     }
   `,
  });

  console.log(JSON.stringify(graphResp, null, 2));
  // {
  //   "body": {
  //     "data": {
  //       "files": [
  //         {
  //           "name": "file-1",
  //           "size": 5,
  //           "mimeType": "text/plain"
  //         },
  //         {
  //           "name": "file-2",
  //           "size": 15,
  //           "mimeType": "text/plain"
  //         }
  //       ]
  //     }
  //   },
  //   "status": 200,
  //   "headers": {}
  // }

  // make a request to a serverless function
  const funcResp = await nhost.functions.post("/helloworld", {
    message: "Hello, World!",
  });
  console.log(JSON.stringify(funcResp.body, null, 2));
  // {
  //   "message": "Hello, World!"
  // }

  expect(uplFilesResp.status).toBe(201);

  expect(graphResp.status).toBe(200);
  expect(graphResp.body.errors).toBeUndefined();
  expect(graphResp.body.data).toStrictEqual({
    files: [
      {
        name: "file-1",
        size: 5,
        mimeType: "text/plain",
      },
      {
        name: "file-2",
        size: 15,
        mimeType: "text/plain",
      },
    ],
  });
});
