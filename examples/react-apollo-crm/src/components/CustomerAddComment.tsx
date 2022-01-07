import { useState } from "react";
import { useParams } from "react-router";
import { nhost } from "../utils/nhost";
import { useInsertCustomerCommentMutation } from "../utils/__generated__/graphql";

export function CustomerAddComment() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<null | File>(null);

  const { customerId } = useParams();
  const [insertCustomerComment, { loading }] =
    useInsertCustomerCommentMutation();

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    let fileMetadata;
    if (file) {
      const fileUploadRes = await nhost.storage.upload({
        file,
        bucketId: "customerComments",
      });

      if (fileUploadRes.error) {
        alert(`error: ${fileUploadRes.error}`);
        return;
      }

      fileMetadata = fileUploadRes.fileMetadata;
    }

    await insertCustomerComment({
      variables: {
        customerComment: {
          text,
          customerId,
          fileId: fileMetadata ? fileMetadata.id : null,
        },
      },
    });

    setText("");
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Comment
        </label>
        <div className="mt-1">
          <textarea
            id="about"
            name="about"
            rows={3}
            className="block w-full max-w-lg border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            defaultValue={""}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-center max-w-lg px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="mr-2">
              <svg
                className="w-12 h-12 mx-auto text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative font-medium text-indigo-600 bg-white rounded-md cursor-pointer hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              {file ? (
                <div>{file.name}</div>
              ) : (
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="pt-5">
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 ml-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading}
            >
              Add
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
