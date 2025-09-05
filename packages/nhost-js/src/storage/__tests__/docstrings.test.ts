import { expect, test } from "@jest/globals";
import { createClient } from "@nhost/nhost-js";
import type { FetchError } from "@nhost/nhost-js/fetch";
import type { ErrorResponse } from "@nhost/nhost-js/storage";

test("basic", async () => {
  const subdomain = "local";
  const region = "local";

  const nhost = createClient({
    subdomain,
    region,
  });

  // Sign up/in to authenticate
  await nhost.auth.signUpEmailPassword({
    email: `test-${Date.now()}@example.com`,
    password: "password123",
  });

  // Upload files to storage
  const uploadResp = await nhost.storage.uploadFiles({
    "file[]": [
      new File(["test content"], "test-file.txt", { type: "text/plain" }),
    ],
  });
  console.log(JSON.stringify(uploadResp, null, 2));
  // {
  //   "body": {
  //     "processedFiles": [
  //       {
  //         "id": "412f4ec0-e347-4e1e-ad5a-8fecb6cb51ed",
  //         "name": "test-file.txt",
  //         "size": 12,
  //         "bucketId": "default",
  //         "etag": "\"9473fdd0d880a43c21b7778d34872157\"",
  //         "createdAt": "2025-07-04T08:27:26.018321+00:00",
  //         "updatedAt": "2025-07-04T08:27:26.021849+00:00",
  //         "isUploaded": true,
  //         "mimeType": "text/plain",
  //         "uploadedByUserId": "",
  //         "metadata": null
  //       }
  //     ]
  //   },
  //   "status": 201,
  //   "headers": {}
  // }

  const fileId = uploadResp.body.processedFiles[0].id;

  // Download a file from storage
  const downloadResp = await nhost.storage.getFile(fileId);
  console.log("Downloaded file content:", await downloadResp.body.text());
  // Downloaded file content: test content

  // Delete the file
  await nhost.storage.deleteFile(fileId);

  expect(uploadResp.status).toBe(201);
  expect(uploadResp.body.processedFiles).toHaveLength(1);
  expect(downloadResp.status).toBe(200);
  expect(downloadResp.body).toBeInstanceOf(Blob);
});

test("error handling for storage", async () => {
  const subdomain = "local";
  const region = "local";

  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.storage.uploadFiles({
      "file[]": [new File(["test1"], "file-1", { type: "text/plain" })],
    });

    expect(true).toBe(false); // This should not be reached
  } catch (error) {
    const err = error as FetchError<ErrorResponse>;
    console.log("Error:", err);
    // Error: {
    //   body: { error: { message: 'you are not authorized' } },
    //   status: 403,
    //   headers: {
    //     'content-length': '46',
    //     'content-type': 'application/json; charset=utf-8',
    //     date: 'Mon, 12 May 2025 08:18:52 GMT'
    //   }
    // }

    // error handling...

    expect(err.status).toBe(403);
    expect(err.body).toStrictEqual({
      error: {
        data: null,
        message: "you are not authorized",
      },
      processedFiles: [],
    });
  }
});

test("error handling for storage error type", async () => {
  const subdomain = "local";
  const region = "local";

  const nhost = createClient({
    subdomain,
    region,
  });

  try {
    await nhost.storage.uploadFiles({
      "file[]": [new File(["test1"], "file-1", { type: "text/plain" })],
    });

    expect(true).toBe(false); // This should not be reached
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error; // Re-throw if it's not an Error
    }

    console.log("Error:", error.message);
    // Error: you are not authorized
    // error handling...

    expect(error.message).toBe("you are not authorized");
  }
});
