/**
 * This file is auto-generated. Do not edit manually.
 */

import type { ChainFunction, FetchResponse } from "../fetch";
import { createEnhancedFetch, FetchError } from "../fetch";

/**
 * Contains version information about the storage service.
 @property buildVersion? (`string`) - The version number of the storage service build.
    *    Example - `"1.2.3"`*/
export interface VersionInformation {
  /**
   * The version number of the storage service build.
    *    Example - `"1.2.3"`
   */
  buildVersion?: string,
};


/**
 * Basic information about a file in storage.
 @property id? (`string`) - Unique identifier for the file.
    *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
 @property name? (`string`) - Name of the file including extension.
    *    Example - `"profile-picture.jpg"`
 @property bucketId? (`string`) - ID of the bucket containing the file.
    *    Example - `"users-bucket"`
 @property isUploaded? (`boolean`) - Whether the file has been successfully uploaded.
    *    Example - `true`*/
export interface FileSummary {
  /**
   * Unique identifier for the file.
    *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
   */
  id?: string,
  /**
   * Name of the file including extension.
    *    Example - `"profile-picture.jpg"`
   */
  name?: string,
  /**
   * ID of the bucket containing the file.
    *    Example - `"users-bucket"`
   */
  bucketId?: string,
  /**
   * Whether the file has been successfully uploaded.
    *    Example - `true`
   */
  isUploaded?: boolean,
};


/**
 * Comprehensive metadata information about a file in storage.
 @property id? (`string`) - Unique identifier for the file.
    *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
 @property name? (`string`) - Name of the file including extension.
    *    Example - `"profile-picture.jpg"`
 @property size? (`number`) - Size of the file in bytes.
    *    Example - `245678`
 @property bucketId? (`string`) - ID of the bucket containing the file.
    *    Example - `"users-bucket"`
 @property etag? (`string`) - Entity tag for cache validation.
    *    Example - `"\"a1b2c3d4e5f6\""`
 @property createdAt? (`string`) - Timestamp when the file was created.
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
 @property updatedAt? (`string`) - Timestamp when the file was last updated.
    *    Example - `"2023-01-16T09:45:32Z"`
    *    Format - date-time
 @property isUploaded? (`boolean`) - Whether the file has been successfully uploaded.
    *    Example - `true`
 @property mimeType? (`string`) - MIME type of the file.
    *    Example - `"image/jpeg"`
 @property uploadedByUserId? (`string`) - ID of the user who uploaded the file.
    *    Example - `"abc123def456"`
 @property metadata? (`Record<string, unknown>`) - Custom metadata associated with the file.
    *    Example - `{"alt":"Profile picture","category":"avatar"}`*/
export interface FileMetadata {
  /**
   * Unique identifier for the file.
    *    Example - `"d5e76ceb-77a2-4153-b7da-1f7c115b2ff2"`
   */
  id?: string,
  /**
   * Name of the file including extension.
    *    Example - `"profile-picture.jpg"`
   */
  name?: string,
  /**
   * Size of the file in bytes.
    *    Example - `245678`
   */
  size?: number,
  /**
   * ID of the bucket containing the file.
    *    Example - `"users-bucket"`
   */
  bucketId?: string,
  /**
   * Entity tag for cache validation.
    *    Example - `"\"a1b2c3d4e5f6\""`
   */
  etag?: string,
  /**
   * Timestamp when the file was created.
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
   */
  createdAt?: string,
  /**
   * Timestamp when the file was last updated.
    *    Example - `"2023-01-16T09:45:32Z"`
    *    Format - date-time
   */
  updatedAt?: string,
  /**
   * Whether the file has been successfully uploaded.
    *    Example - `true`
   */
  isUploaded?: boolean,
  /**
   * MIME type of the file.
    *    Example - `"image/jpeg"`
   */
  mimeType?: string,
  /**
   * ID of the user who uploaded the file.
    *    Example - `"abc123def456"`
   */
  uploadedByUserId?: string,
  /**
   * Custom metadata associated with the file.
    *    Example - `{"alt":"Profile picture","category":"avatar"}`
   */
  metadata?: Record<string, unknown>,
};


/**
 * Metadata provided when uploading a new file.
 @property id? (`string`) - Optional custom ID for the file. If not provided, a UUID will be generated.
    *    Example - `"custom-id-123"`
 @property name? (`string`) - Name to assign to the file. If not provided, the original filename will be used.
    *    Example - `"custom-filename.png"`
 @property metadata? (`Record<string, unknown>`) - Custom metadata to associate with the file.
    *    Example - `{"alt":"Custom image","category":"document"}`*/
export interface UploadFileMetadata {
  /**
   * Optional custom ID for the file. If not provided, a UUID will be generated.
    *    Example - `"custom-id-123"`
   */
  id?: string,
  /**
   * Name to assign to the file. If not provided, the original filename will be used.
    *    Example - `"custom-filename.png"`
   */
  name?: string,
  /**
   * Custom metadata to associate with the file.
    *    Example - `{"alt":"Custom image","category":"document"}`
   */
  metadata?: Record<string, unknown>,
};


/**
 * Metadata that can be updated for an existing file.
 @property name? (`string`) - New name to assign to the file.
    *    Example - `"renamed-file.jpg"`
 @property metadata? (`Record<string, unknown>`) - Updated custom metadata to associate with the file.
    *    Example - `{"alt":"Updated image description","category":"profile"}`*/
export interface UpdateFileMetadata {
  /**
   * New name to assign to the file.
    *    Example - `"renamed-file.jpg"`
   */
  name?: string,
  /**
   * Updated custom metadata to associate with the file.
    *    Example - `{"alt":"Updated image description","category":"profile"}`
   */
  metadata?: Record<string, unknown>,
};


/**
 * Error details.
 @property message (`string`) - Human-readable error message.
    *    Example - `"File not found"`*/
export interface ErrorResponseError {
  /**
   * Human-readable error message.
    *    Example - `"File not found"`
   */
  message: string,
};


/**
 * Error information returned by the API.
 @property error? (`ErrorResponseError`) - Error details.*/
export interface ErrorResponse {
  /**
   * Error details.
   */
  error?: ErrorResponseError,
};


/**
 * Request to refresh an access token
 @property refreshToken (`string`) - Refresh token used to generate a new access token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b*/
export interface RefreshTokenRequest {
  /**
   * Refresh token used to generate a new access token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  refreshToken: string,
};


/**
 * User authentication session containing tokens and user information
 @property accessToken (`string`) - JWT token for authenticating API requests
    *    Example - `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
 @property accessTokenExpiresIn (`number`) - Expiration time of the access token in seconds
    *    Example - `900`
    *    Format - int64
 @property refreshTokenId (`string`) - Identifier for the refresh token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
 @property refreshToken (`string`) - Token used to refresh the access token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
 @property user? (`User`) - User profile and account information*/
export interface Session {
  /**
   * JWT token for authenticating API requests
    *    Example - `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
   */
  accessToken: string,
  /**
   * Expiration time of the access token in seconds
    *    Example - `900`
    *    Format - int64
   */
  accessTokenExpiresIn: number,
  /**
   * Identifier for the refresh token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  refreshTokenId: string,
  /**
   * Token used to refresh the access token
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  refreshToken: string,
  /**
   * User profile and account information
   */
  user?: User,
};


/**
 * User profile and account information
 @property avatarUrl (`string`) - URL to the user's profile picture
    *    Example - `"https://myapp.com/avatars/user123.jpg"`
 @property createdAt (`string`) - Timestamp when the user account was created
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
 @property defaultRole (`string`) - Default authorization role for the user
    *    Example - `"user"`
 @property displayName (`string`) - User's display name
    *    Example - `"John Smith"`
 @property email? (`string`) - User's email address
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
 @property emailVerified (`boolean`) - Whether the user's email has been verified
    *    Example - `true`
 @property id (`string`) - Unique identifier for the user
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
 @property isAnonymous (`boolean`) - Whether this is an anonymous user account
    *    Example - `false`
 @property locale (`string`) - User's preferred locale (language code)
    *    Example - `"en"`
    *    MinLength - 2
    *    MaxLength - 2
 @property metadata (`Record<string, unknown>`) - Custom metadata associated with the user
    *    Example - `{"firstName":"John","lastName":"Smith"}`
 @property phoneNumber? (`string`) - User's phone number
    *    Example - `"+12025550123"`
 @property phoneNumberVerified (`boolean`) - Whether the user's phone number has been verified
    *    Example - `false`
 @property roles (`string[]`) - List of roles assigned to the user
    *    Example - `["user","customer"]`*/
export interface User {
  /**
   * URL to the user's profile picture
    *    Example - `"https://myapp.com/avatars/user123.jpg"`
   */
  avatarUrl: string,
  /**
   * Timestamp when the user account was created
    *    Example - `"2023-01-15T12:34:56Z"`
    *    Format - date-time
   */
  createdAt: string,
  /**
   * Default authorization role for the user
    *    Example - `"user"`
   */
  defaultRole: string,
  /**
   * User's display name
    *    Example - `"John Smith"`
   */
  displayName: string,
  /**
   * User's email address
    *    Example - `"john.smith@nhost.io"`
    *    Format - email
   */
  email?: string,
  /**
   * Whether the user's email has been verified
    *    Example - `true`
   */
  emailVerified: boolean,
  /**
   * Unique identifier for the user
    *    Example - `"2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24"`
    *    Pattern - \b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b
   */
  id: string,
  /**
   * Whether this is an anonymous user account
    *    Example - `false`
   */
  isAnonymous: boolean,
  /**
   * User's preferred locale (language code)
    *    Example - `"en"`
    *    MinLength - 2
    *    MaxLength - 2
   */
  locale: string,
  /**
   * Custom metadata associated with the user
    *    Example - `{"firstName":"John","lastName":"Smith"}`
   */
  metadata: Record<string, unknown>,
  /**
   * User's phone number
    *    Example - `"+12025550123"`
   */
  phoneNumber?: string,
  /**
   * Whether the user's phone number has been verified
    *    Example - `false`
   */
  phoneNumberVerified: boolean,
  /**
   * List of roles assigned to the user
    *    Example - `["user","customer"]`
   */
  roles: string[],
};


/**
 * Unique identifier of the file
 */
export type FileId = string;


/**
 * Only return the file if the current ETag matches one of the values provided
 */
export type IfMatch = string;


/**
 * Only return the file if the current ETag does not match any of the values provided
 */
export type IfNoneMatch = string;


/**
 * Only return the file if it has been modified after the given date
 */
export type IfModifiedSince = string;


/**
 * Only return the file if it has not been modified after the given date
 */
export type IfUnmodifiedSince = string;


/**
 * Image quality (1-100). Only applies to JPEG, WebP and PNG files
 */
export type ImageQuality = number;


/**
 * Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
 */
export type MaxHeight = number;


/**
 * Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
 */
export type MaxWidth = number;


/**
 * Blur the image using this sigma value. Only applies to image files
 */
export type BlurSigma = number;


/**
 * Format to convert the image to. If 'auto', the format is determined based on the Accept header.
 */
export type OutputFormat = "auto" | "same" | "jpeg" | "webp" | "png" | "avif";


/**
 * Ticket
 */
export type TicketQuery = string;


/**
 * Type of the ticket
 */
export type TicketTypeQuery = "emailVerify" | "emailConfirmChange" | "signinPasswordless" | "passwordReset";


/**
 * Target URL for the redirect
 */
export type RedirectToQuery = string;


/**
 * 
 @property bucket-id? (`string`) - Target bucket identifier where files will be stored.
    *    Example - `"user-uploads"`
 @property metadata[]? (`FileMetadata[]`) - Optional custom metadata for each uploaded file. Must match the order of the file[] array.
 @property file[] (`Blob[]`) - Array of files to upload.*/
export interface UploadFilesBody {
  /**
   * Target bucket identifier where files will be stored.
    *    Example - `"user-uploads"`
   */
  "bucket-id"?: string,
  /**
   * Optional custom metadata for each uploaded file. Must match the order of the file[] array.
   */
  "metadata[]"?: FileMetadata[],
  /**
   * Array of files to upload.
   */
  "file[]": Blob[],
};


/**
 * 
 @property processedFiles? (`FileMetadata[]`) - List of successfully processed files with their metadata.*/
export interface UploadFilesResponse201 {
  /**
   * List of successfully processed files with their metadata.
   */
  processedFiles?: FileMetadata[],
};


/**
 * 
 @property metadata? (`UpdateFileMetadata`) - Metadata that can be updated for an existing file.
 @property file (`Blob`) - New file content to replace the existing file
    *    Format - binary*/
export interface ReplaceFileBody {
  /**
   * Metadata that can be updated for an existing file.
   */
  metadata?: UpdateFileMetadata,
  /**
   * New file content to replace the existing file
    *    Format - binary
   */
  file: Blob,
};

/**
 * Parameters for the getFileMetadataHeaders method.
    @property q? (ImageQuality) - 
    *    Image quality (1-100). Only applies to JPEG, WebP and PNG files
    @property h? (MaxHeight) - 
    *    Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
    @property w? (MaxWidth) - 
    *    Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
    @property b? (BlurSigma) - 
    *    Blur the image using this sigma value. Only applies to image files
    @property f? (OutputFormat) - 
    *    Format to convert the image to. If 'auto', the format is determined based on the Accept header.*/
export interface GetFileMetadataHeadersParams {
  /**
   * 
    *    Image quality (1-100). Only applies to JPEG, WebP and PNG files
   */
  q?: ImageQuality;
  /**
   * 
    *    Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
   */
  h?: MaxHeight;
  /**
   * 
    *    Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
   */
  w?: MaxWidth;
  /**
   * 
    *    Blur the image using this sigma value. Only applies to image files
   */
  b?: BlurSigma;
  /**
   * 
    *    Format to convert the image to. If 'auto', the format is determined based on the Accept header.
   */
  f?: OutputFormat;
}
/**
 * Parameters for the getFile method.
    @property q? (ImageQuality) - 
    *    Image quality (1-100). Only applies to JPEG, WebP and PNG files
    @property h? (MaxHeight) - 
    *    Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
    @property w? (MaxWidth) - 
    *    Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
    @property b? (BlurSigma) - 
    *    Blur the image using this sigma value. Only applies to image files
    @property f? (OutputFormat) - 
    *    Format to convert the image to. If 'auto', the format is determined based on the Accept header.*/
export interface GetFileParams {
  /**
   * 
    *    Image quality (1-100). Only applies to JPEG, WebP and PNG files
   */
  q?: ImageQuality;
  /**
   * 
    *    Maximum height to resize image to while maintaining aspect ratio. Only applies to image files
   */
  h?: MaxHeight;
  /**
   * 
    *    Maximum width to resize image to while maintaining aspect ratio. Only applies to image files
   */
  w?: MaxWidth;
  /**
   * 
    *    Blur the image using this sigma value. Only applies to image files
   */
  b?: BlurSigma;
  /**
   * 
    *    Format to convert the image to. If 'auto', the format is determined based on the Accept header.
   */
  f?: OutputFormat;
}
/**
 * Parameters for the verifyTicket method.
    @property ticket (TicketQuery) - Ticket
  
    *    Ticket
    @property redirectTo (RedirectToQuery) - Target URL for the redirect
  
    *    Target URL for the redirect*/
export interface VerifyTicketParams {
  /**
   * Ticket
  
    *    Ticket
   */
  ticket: TicketQuery;
  /**
   * Target URL for the redirect
  
    *    Target URL for the redirect
   */
  redirectTo: RedirectToQuery;
}


export interface Client {
  baseURL: string;

  /** Add a middleware function to the fetch chain
   * @param chainFunction - The middleware function to add
   */
  pushChainFunction(chainFunction: ChainFunction): void;
    /**
     Summary: Refresh access token
     Generate a new JWT access token using a valid refresh token. The refresh token used will be revoked and a new one will be issued.

     This method may return different T based on the response code:
     - 200: Session
     */
  refreshToken(
    body: RefreshTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<Session>>;

    /**
     Summary: Upload files
     Upload one or more files to a specified bucket. Supports batch uploading with optional custom metadata for each file. If uploading multiple files, either provide metadata for all files or none.

     This method may return different T based on the response code:
     - 201: UploadFilesResponse201
     - 400: ErrorResponse
     */
  uploadFiles(
    body: UploadFilesBody,
    options?: RequestInit,
  ): Promise<FetchResponse<UploadFilesResponse201>>;

    /**
     Summary: Check file information
     Retrieve file metadata headers without downloading the file content. Supports conditional requests and provides caching information.

     This method may return different T based on the response code:
     - 200: void
     - 304: void
     - 400: void
     - 412: void
     */
  getFileMetadataHeaders(
    id: FileId,
    params?: GetFileMetadataHeadersParams,
    options?: RequestInit,
  ): Promise<FetchResponse<void>>;

    /**
     Summary: Download file
     Retrieve and download the complete file content. Supports conditional requests, image transformations, and range requests for partial downloads.

     This method may return different T based on the response code:
     - 200: void
     - 304: void
     - 400: void
     - 412: void
     */
  getFile(
    id: FileId,
    params?: GetFileParams,
    options?: RequestInit,
  ): Promise<FetchResponse<Blob>>;

    /**
     Summary: Replace file
     Replace an existing file with new content while preserving the file ID. The operation follows these steps:
1. The isUploaded flag is set to false to mark the file as being updated
2. The file content is replaced in the storage backend
3. File metadata is updated (size, mime-type, isUploaded, etc.)

Each step is atomic, but if a step fails, previous steps will not be automatically rolled back.


     This method may return different T based on the response code:
     - 200: FileMetadata
     - 400: ErrorResponse
     */
  replaceFile(
    id: FileId,
    body?: ReplaceFileBody,
    options?: RequestInit,
  ): Promise<FetchResponse<FileMetadata>>;

    /**
     Summary: Delete file
     Permanently delete a file from storage. This removes both the file content and its associated metadata.

     This method may return different T based on the response code:
     - 204: void
     - 400: ErrorResponse
     */
  deleteFile(
    id: FileId,
    options?: RequestInit,
  ): Promise<FetchResponse<void>>;

    /**
     Summary: Verify tickets created by email verification, email passwordless authentication (magic link), or password reset
     

     As this method is a redirect, it returns a URL string instead of a Promise
     */
  verifyTicketURL(
    params?: VerifyTicketParams,
    options?: RequestInit,
  ): string;
};


export const createAPIClient = (
  baseURL: string,
  chainFunctions: ChainFunction[] = [],
): Client => {
  let fetch = createEnhancedFetch(chainFunctions);

  const pushChainFunction = (chainFunction: ChainFunction) => {
    chainFunctions.push(chainFunction);
    fetch = createEnhancedFetch(chainFunctions);
  };
    const  refreshToken = async (
    body: RefreshTokenRequest,
    options?: RequestInit,
  ): Promise<FetchResponse<Session>> => {
    const url = `${ baseURL }/token`;
    const res = await fetch(url, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text();
    const payload: Session = responseBody ? JSON.parse(responseBody) : {};
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<Session>;

  };

    const  uploadFiles = async (
    body: UploadFilesBody,
    options?: RequestInit,
  ): Promise<FetchResponse<UploadFilesResponse201>> => {
    const url = `${ baseURL }/files/`;
    const formData = new FormData();
    const isReactNative =
      typeof navigator !== "undefined" &&
      (navigator as { product?: string }).product === "ReactNative";
    if (body["bucket-id"] !== undefined) {
      formData.append("bucket-id", body["bucket-id"]);
    }
    if (body["metadata[]"] !== undefined) {
      body["metadata[]"].forEach((value) => {
          if (isReactNative) {
            formData.append(
              "metadata[]",
              {
                string: JSON.stringify(value),
                type: "application/json",
                name: "",
              } as unknown as Blob,
            );
          } else {
            formData.append(
            "metadata[]",
              new Blob([JSON.stringify(value)], { type: "application/json" }),
              "",
            );
          }
        }
      );
    }
    if (body["file[]"] !== undefined) {
      body["file[]"].forEach((value) => {
          formData.append("file[]", value)
        }
      );
    }

    const res = await fetch(url, {
      ...options,
      method: "POST",
      body: formData,
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text();
    const payload: UploadFilesResponse201 = responseBody ? JSON.parse(responseBody) : {};
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<UploadFilesResponse201>;

  };

    const  getFileMetadataHeaders = async (
    id: FileId,
    params?: GetFileMetadataHeadersParams,
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .flatMap(([key, value]) => {
        // Default handling (scalars or explode: false)
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value)
        return [`${key}=${encodeURIComponent(stringValue)}`]
      })
      .join('&')

    const url =
     encodedParameters
        ? `${ baseURL }/files/${id}?${encodedParameters}`
        : `${ baseURL }/files/${id}`;
    const res = await fetch(url, {
      ...options,
      method: "HEAD",
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const payload: undefined = undefined;
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<void>;

  };

    const  getFile = async (
    id: FileId,
    params?: GetFileParams,
    options?: RequestInit,
  ): Promise<FetchResponse<Blob>> => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .flatMap(([key, value]) => {
        // Default handling (scalars or explode: false)
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value)
        return [`${key}=${encodeURIComponent(stringValue)}`]
      })
      .join('&')

    const url =
     encodedParameters
        ? `${ baseURL }/files/${id}?${encodedParameters}`
        : `${ baseURL }/files/${id}`;
    const res = await fetch(url, {
      ...options,
      method: "GET",
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const payload: Blob = await res.blob();
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<Blob>;

  };

    const  replaceFile = async (
    id: FileId,
    body?: ReplaceFileBody,
    options?: RequestInit,
  ): Promise<FetchResponse<FileMetadata>> => {
    const url = `${ baseURL }/files/${id}`;
    const formData = new FormData();
    const isReactNative =
      typeof navigator !== "undefined" &&
      (navigator as { product?: string }).product === "ReactNative";
    if (body["metadata"] !== undefined) {
      if (isReactNative) {
        formData.append(
          "metadata",
          {
            string: JSON.stringify(body["metadata"]),
            type: "application/json",
            name: "",
          } as unknown as Blob,
        );
      } else {
        formData.append(
        "metadata",
          new Blob([JSON.stringify(body["metadata"])], { type: "application/json" }),
          "",
        );
      }
    }
    if (body["file"] !== undefined) {
      formData.append("file", body["file"]);
    }

    const res = await fetch(url, {
      ...options,
      method: "PUT",
      body: formData,
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const responseBody = [204, 205, 304].includes(res.status) ? null : await res.text();
    const payload: FileMetadata = responseBody ? JSON.parse(responseBody) : {};
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<FileMetadata>;

  };

    const  deleteFile = async (
    id: FileId,
    options?: RequestInit,
  ): Promise<FetchResponse<void>> => {
    const url = `${ baseURL }/files/${id}`;
    const res = await fetch(url, {
      ...options,
      method: "DELETE",
      headers: {
        ...options?.headers,
      },
    });

    if (res.status >= 300) {
      const responseBody = [412].includes(res.status) ? null : await res.text();
      const payload: unknown = responseBody ? JSON.parse(responseBody) : {};
      throw new FetchError(payload, res.status, res.headers);
    }
    
    const payload: undefined = undefined;
    

    return {
      body: payload,
      status: res.status,
      headers: res.headers,
    } as FetchResponse<void>;

  };

    const  verifyTicketURL = (
    params?: VerifyTicketParams,
  ): string => {
  const encodedParameters =
    params &&
    Object.entries(params)
      .flatMap(([key, value]) => {
        // Default handling (scalars or explode: false)
        const stringValue = Array.isArray(value)
          ? value.join(',')
          : typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value)
        return [`${key}=${encodeURIComponent(stringValue)}`]
      })
      .join('&')

    const url =
     encodedParameters
        ? `${ baseURL }/verify?${encodedParameters}`
        : `${ baseURL }/verify`;
    return url;
  };


  return {
    baseURL,
    pushChainFunction,
      refreshToken,
      uploadFiles,
      getFileMetadataHeaders,
      getFile,
      replaceFile,
      deleteFile,
      verifyTicketURL,
  };
};
