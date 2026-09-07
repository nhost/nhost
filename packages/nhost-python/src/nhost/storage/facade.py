"""Idiomatic conveniences layered over the spec-generated Storage client."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from ..fetch import ChainFunction, FetchResponse, UploadFile
from .client import (
    Client,
    FileMetadata,
    ReplaceFileBody,
    UpdateFileMetadata,
    UploadFileMetadata,
    UploadFilesBody,
    UploadFilesResponse201,
)


class StorageClient(Client):
    """Generated Storage API plus stable, idiomatic convenience operations."""

    def add_middleware(self, middleware: ChainFunction) -> None:
        """Append HTTP middleware to the Storage request pipeline."""
        self.push_chain_function(middleware)

    async def upload(
        self,
        files: Sequence[bytes | UploadFile],
        *,
        bucket_id: str | None = None,
        metadata: Sequence[UploadFileMetadata] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchResponse[UploadFilesResponse201]:
        """Upload one or more files without constructing a wire-shaped body."""
        body = UploadFilesBody(
            file=list(files),
            bucket_id=bucket_id,
            metadata=None if metadata is None else list(metadata),
        )
        return await self.upload_files(body=body, headers=headers)

    async def replace_file_content(
        self,
        file_id: str,
        *,
        file: bytes | UploadFile,
        metadata: UpdateFileMetadata | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> FetchResponse[FileMetadata]:
        """Replace a file while preserving its identifier.

        When passing metadata, include its ``name`` field: the Storage API treats
        an omitted replacement name as empty rather than preserving the old name.
        """
        return await self.replace_file(
            file_id,
            body=ReplaceFileBody(file=file, metadata=metadata),
            headers=headers,
        )
