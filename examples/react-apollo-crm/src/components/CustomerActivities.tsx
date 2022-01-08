import { ChatAltIcon } from "@heroicons/react/solid";
import { useGetCustomerCommentsSubscription } from "../utils/__generated__/graphql";
import { useParams } from "react-router";
import { nhost } from "../utils/nhost";
import { PhotographIcon } from "@heroicons/react/outline";
import prettyBytes from "pretty-bytes";
import { formatDistanceToNow, parseISO } from "date-fns";

export function CustomerActivities() {
  const { customerId } = useParams();

  const { data, loading } = useGetCustomerCommentsSubscription({
    variables: {
      where: {
        customerId: {
          _eq: customerId,
        },
      },
    },
  });

  console.log({ data });

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!data || !data.customerComments) {
    return <div>no comments</div>;
  }

  const { customerComments } = data;

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {customerComments.map((comment, i) => {
          return (
            <li key={comment.id}>
              <div className="relative pb-8">
                {i !== customerComments.length - 1 ? (
                  <span
                    className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex items-start space-x-3">
                  <>
                    <div className="relative">
                      <img
                        className="flex items-center justify-center w-10 h-10 bg-gray-400 rounded-full ring-8 ring-white"
                        src={comment.user.avatarUrl}
                        alt=""
                      />

                      <span className="absolute -bottom-0.5 -right-1 bg-white rounded-tl px-0.5 py-px">
                        <ChatAltIcon
                          className="w-5 h-5 text-gray-400"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">
                            {comment.user.displayName}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {formatDistanceToNow(parseISO(comment.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        <p>{comment.text}</p>
                      </div>
                      {comment.file && (
                        <div
                          className="flex items-center mt-3 text-sm text-gray-700 cursor-pointer"
                          onClick={async () => {
                            const { presignedUrl, error } =
                              await nhost.storage.getPresignedUrl({
                                fileId: comment.file!.id,
                              });

                            if (error) {
                              return alert(error.message);
                            }

                            window.open(presignedUrl?.url, "_blank");
                          }}
                        >
                          <div>
                            <PhotographIcon className="w-5 mr-1 text-gray-500" />
                          </div>
                          <div>
                            {comment.file.name},{" "}
                            {prettyBytes(comment.file.size as number)}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
