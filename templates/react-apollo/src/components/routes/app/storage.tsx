import UploadMultipleFiles from '@/components/storage/upload-multiple-files'
import UploadSingleFile from '@/components/storage/upload-single-file'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export default function Storage() {
  return (
    <div className="flex flex-col w-full gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
      </Card>
      <UploadSingleFile />
      <UploadMultipleFiles />
    </div>
  )
}
