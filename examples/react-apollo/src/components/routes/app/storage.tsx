import UploadMultipleFiles from '@/components/storage/upload-multiple-files'
import UploadSingleFile from '@/components/storage/upload-single-file'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { gql } from '@apollo/client'
import { useNhostClient } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { DownloadCloudIcon } from 'lucide-react'

export default function Storage() {
  const nhost = useNhostClient()

  const { data, refetch } = useAuthQuery<{
    files: {
      id: string
      name: string
      mimeType: string
      size: number
      createdAt: string
    }[]
  }>(gql`
    {
      files(limit: 5, order_by: { createdAt: desc }) {
        id
        name
        mimeType
        createdAt
        size
      }
    }
  `)

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    const response = await nhost.storage.download({ fileId })

    if (response.file) {
      const url = window.URL.createObjectURL(response.file)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      window.URL.revokeObjectURL(url)
    }
  }

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
          <CardDescription>A list of your recently uploaded files</CardDescription>
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
              {data?.files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>{file.name}</TableCell>
                  <TableCell>{file.mimeType}</TableCell>
                  <TableCell>{file.createdAt}</TableCell>
                  <TableCell>
                    <Button variant="ghost" onClick={() => handleDownloadFile(file.id, file.name)}>
                      <DownloadCloudIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UploadSingleFile onUpload={refetch} />
      <UploadMultipleFiles onUpload={refetch} />
    </div>
  )
}
