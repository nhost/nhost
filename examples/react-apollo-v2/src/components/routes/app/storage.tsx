import UploadMultipleFiles from '../../storage/upload-multiple-files'
import UploadSingleFile from '../../storage/upload-single-file'
import { Card, CardHeader, CardTitle } from '../../ui/card'

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
