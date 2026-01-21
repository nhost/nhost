// import UploadMultipleFiles from "@/components/storage/upload-multiple-files";
import UploadSingleFile from "@/components/storage/upload-single-file";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DownloadCloudIcon } from "lucide-react";
import { useNhostClient } from "@/providers/nhost";
import { useEffect, useState } from "react";

export default function Storage() {
  const nhost = useNhostClient();
  const [files, setFiles] = useState<
    {
      id: string;
      name: string;
      mimeType: string;
      size: number;
      createdAt: string;
    }[]
  >([]);

  const refetchFiles = async () => {
    const response = await nhost.graphql.request<{
      files: {
        id: string;
        name: string;
        mimeType: string;
        size: number;
        createdAt: string;
      }[];
    }>({
      query: `
        {
          files(limit: 5, order_by: { createdAt: desc }) {
            id
            name
            mimeType
            createdAt
            size
          }
        }
      `,
    });
    setFiles(response.body.data?.files || []);
  };

  useEffect(() => {
    refetchFiles();
  }, []);

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    const response = await nhost.storage.getFile(fileId);

    if (response.body) {
      const url = window.URL.createObjectURL(response.body);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col w-full gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            A list of your recently uploaded files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>{file.name}</TableCell>
                  <TableCell>{file.mimeType}</TableCell>
                  <TableCell>{file.createdAt}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      onClick={() => handleDownloadFile(file.id, file.name)}
                    >
                      <DownloadCloudIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UploadSingleFile onUpload={refetchFiles} />
      {/* <UploadMultipleFiles onUpload={refetchFiles} /> */}
    </div>
  );
}
