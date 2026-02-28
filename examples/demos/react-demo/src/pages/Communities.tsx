import type { FetchError } from '@nhost/nhost-js/fetch';
import type { ErrorResponse, FileMetadata } from '@nhost/nhost-js/storage';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';
import { formatFileSize } from '../lib/utils';

interface Community {
  id: string;
  name: string;
  description: string | null;
  members: Array<{ id: string; user_id: string }>;
}

interface CommunityFile {
  id: string;
  file: FileMetadata & { uploadedByUser: { displayName: string } | null };
}

export default function Communities(): JSX.Element {
  const { nhost, session } = useAuth();
  const userId = session?.user?.id;

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(
    null,
  );
  const [communityFiles, setCommunityFiles] = useState<CommunityFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await nhost.graphql.request<{
        communities: Community[];
      }>({
        query: `query GetCommunities {
          communities {
            id
            name
            description
            members {
              id
              user_id
            }
          }
        }`,
      });
      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to fetch communities',
        );
      }
      setCommunities(response.body.data?.communities || []);
    } catch (err) {
      setError('Failed to load communities.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  const fetchCommunityFiles = useCallback(
    async (communityId: string) => {
      setFilesLoading(true);
      try {
        const response = await nhost.graphql.request<{
          community_files: CommunityFile[];
        }>({
          query: `query GetCommunityFiles($communityId: uuid!) {
          community_files(where: { community_id: { _eq: $communityId } }) {
            id
            file {
              id
              name
              size
              mimeType
              uploadedByUser {
                displayName
              }
            }
          }
        }`,
          variables: { communityId },
        });
        if (response.body.errors) {
          throw new Error(
            response.body.errors[0]?.message || 'Failed to fetch files',
          );
        }
        setCommunityFiles(response.body.data?.community_files || []);
      } catch (err) {
        setError('Failed to load community files.');
        console.error(err);
      } finally {
        setFilesLoading(false);
      }
    },
    [nhost.graphql],
  );

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  useEffect(() => {
    if (selectedCommunity) {
      fetchCommunityFiles(selectedCommunity);
    }
  }, [selectedCommunity, fetchCommunityFiles]);

  const handleJoin = async (communityId: string) => {
    try {
      const response = await nhost.graphql.request({
        query: `mutation JoinCommunity($communityId: uuid!) {
          insert_community_members_one(object: { community_id: $communityId }) {
            id
          }
        }`,
        variables: { communityId },
      });
      if (response.body.errors) {
        throw new Error(response.body.errors[0]?.message || 'Failed to join');
      }
      await fetchCommunities();
    } catch (err) {
      console.error(err);
      setError('Failed to join community.');
    }
  };

  const handleLeave = async (communityId: string) => {
    if (!userId) return;
    try {
      const response = await nhost.graphql.request({
        query: `mutation LeaveCommunity($communityId: uuid!, $userId: uuid!) {
          delete_community_members(where: { community_id: { _eq: $communityId }, user_id: { _eq: $userId } }) {
            affected_rows
          }
        }`,
        variables: { communityId, userId },
      });
      if (response.body.errors) {
        throw new Error(response.body.errors[0]?.message || 'Failed to leave');
      }
      await fetchCommunities();
      if (selectedCommunity === communityId) {
        setSelectedCommunity(null);
        setCommunityFiles([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to leave community.');
    }
  };

  const handleUpload = async (file: File) => {
    if (!selectedCommunity) return;
    setUploading(true);
    setError(null);

    try {
      // 1. Upload file to the communities bucket
      const uploadResponse = await nhost.storage.uploadFiles({
        'bucket-id': 'communities',
        'file[]': [file],
      });

      const uploadedFile = uploadResponse.body.processedFiles?.[0];
      if (!uploadedFile?.id) throw new Error('Upload failed');

      // 2. Associate the file with the community
      const response = await nhost.graphql.request({
        query: `mutation AddCommunityFile($fileId: uuid!, $communityId: uuid!) {
          insert_community_files_one(object: { file_id: $fileId, community_id: $communityId }) {
            id
          }
        }`,
        variables: { fileId: uploadedFile.id, communityId: selectedCommunity },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to associate file',
        );
      }

      setStatusMessage({
        message: 'File uploaded successfully',
        isError: false,
      });
      await fetchCommunityFiles(selectedCommunity);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewFile = async (
    fileId: string,
    fileName: string,
    mimeType: string,
  ) => {
    try {
      const response = await nhost.storage.getFile(fileId);
      const url = URL.createObjectURL(response.body);
      if (
        mimeType.startsWith('image/') ||
        mimeType === 'application/pdf' ||
        mimeType.startsWith('text/') ||
        mimeType.startsWith('video/') ||
        mimeType.startsWith('audio/')
      ) {
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`Failed to view file: ${error.message}`);
    }
  };

  const handleRemoveFile = async (communityFileId: string, fileId: string) => {
    try {
      await nhost.graphql.request({
        query: `mutation RemoveCommunityFile($id: uuid!) {
          delete_community_files_by_pk(id: $id) {
            id
          }
        }`,
        variables: { id: communityFileId },
      });

      await nhost.storage.deleteFile(fileId);

      setStatusMessage({ message: 'File removed', isError: false });
      if (selectedCommunity) await fetchCommunityFiles(selectedCommunity);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`Failed to remove file: ${error.message}`);
    }
  };

  const isMember = (community: Community) =>
    community.members.some((m) => m.user_id === userId);

  const selectedCommunityData = communities.find(
    (c) => c.id === selectedCommunity,
  );
  const selectedName = selectedCommunityData?.name;

  return (
    <div className="flex flex-col">
      <h1 className="text-3xl mb-6 gradient-text">Communities</h1>

      {error && <div className="alert alert-error mb-4">{error}</div>}
      {statusMessage && (
        <div
          className={`alert ${statusMessage.isError ? 'alert-error' : 'alert-success'} mb-4`}
        >
          {statusMessage.message}
        </div>
      )}

      {/* Communities List */}
      <div className="glass-card p-8 mb-6">
        <h2 className="text-2xl mb-4">All Communities</h2>
        {loading ? (
          <p className="text-center">Loading communities...</p>
        ) : communities.length === 0 ? (
          <p className="text-center">No communities found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Members</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {communities.map((community) => (
                  <tr key={community.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedCommunity(community.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                          font: 'inherit',
                        }}
                      >
                        {community.name}
                      </button>
                    </td>
                    <td>{community.description}</td>
                    <td>{community.members.length}</td>
                    <td>
                      {isMember(community) ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleLeave(community.id)}
                        >
                          Leave
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleJoin(community.id)}
                        >
                          Join
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Community Files */}
      {selectedCommunityData && isMember(selectedCommunityData) && (
        <div className="glass-card p-8">
          <h2 className="text-2xl mb-4">{selectedName} — Files</h2>

          {/* Upload */}
          <div className="mb-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>

          {filesLoading ? (
            <p className="text-center">Loading files...</p>
          ) : communityFiles.length === 0 ? (
            <p className="text-center">No files yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Uploaded By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {communityFiles.map((cf) => (
                    <tr key={cf.id}>
                      <td>{cf.file.name}</td>
                      <td>{formatFileSize(cf.file.size || 0)}</td>
                      <td>
                        {cf.file.uploadedByUser?.displayName || 'Unknown'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="action-icon action-icon-view"
                            title="View File"
                            onClick={() =>
                              handleViewFile(
                                cf.file.id || '',
                                cf.file.name || 'file',
                                cf.file.mimeType || 'application/octet-stream',
                              )
                            }
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="View file"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="action-icon action-icon-delete"
                            title="Remove File"
                            onClick={() =>
                              handleRemoveFile(cf.id, cf.file.id || '')
                            }
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              role="img"
                              aria-label="Delete file"
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedCommunityData && !isMember(selectedCommunityData) && (
        <div className="glass-card p-8">
          <p className="text-center">
            Join <strong>{selectedName}</strong> to see and upload files.
          </p>
        </div>
      )}
    </div>
  );
}
