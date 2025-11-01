import { gql, useMutation, useQuery } from "@apollo/client";

import { useSecurity } from "@/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Plus, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type NotesListQuery = {
  notes: {
    id: string;
    content: string;
  }[];
};

const GET_NOTES = gql`
  query notesList {
    notes {
      id
      content
    }
  }
`;

const INSERT_NOTE = gql`
  mutation insertNote($content: String!) {
    insertNote(object: { content: $content }) {
      id
      content
    }
  }
`;

const DELETE_NOTE = gql`
  mutation deleteNote($noteId: uuid!) {
    deleteNote(id: $noteId) {
      id
      content
    }
  }
`;

export default function ProtectedNotes() {
  const [content, setContent] = useState("");
  const { requiresElevation, checkElevation } = useSecurity();

  const { data } = useQuery<NotesListQuery>(GET_NOTES);
  const notes = data?.notes || [];

  const [addNoteMutation] = useMutation<{
    insertNote?: {
      id: string;
      content: string;
    };
  }>(INSERT_NOTE, {
    refetchQueries: [{ query: GET_NOTES }],
    awaitRefetchQueries: true,
  });

  const [deleteNoteMutation] = useMutation<{
    deleteNote?: {
      id: string;
      content: string;
    };
  }>(DELETE_NOTE, {
    refetchQueries: [{ query: GET_NOTES }],
    awaitRefetchQueries: true,
  });

  const checkElevatedPermission = async () => {
    if (requiresElevation) {
      await checkElevation();
    }
  };

  const add = async () => {
    if (!content) return;

    try {
      await checkElevatedPermission();
    } catch {
      toast.error("Could not elevate permissions");

      return;
    }

    addNoteMutation({
      variables: { content },
      onCompleted: () => {
        setContent("");
        toast.success("Note added successfully");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const deleteNote = async (noteId: string) => {
    if (!noteId) return;

    try {
      await checkElevatedPermission();
    } catch {
      toast.error("Could not elevate permissions");
      return;
    }

    deleteNoteMutation({
      variables: { noteId },
      onCompleted: () => {
        toast.success("Note deleted successfully");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <div className="w-full">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Protected Notes</CardTitle>
        </CardHeader>
      </Card>

      <Card className="w-full pt-6">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-row gap-4">
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => e.code === "Enter" && add()}
            />
            <Button className="m-0" onClick={() => add()}>
              <Plus />
              Add
            </Button>
          </div>
          <div>
            {notes?.length === 0 && (
              <Alert className="w-full">
                <Info className="w-4 h-4" />
                <AlertTitle>Empty</AlertTitle>
                <AlertDescription className="mt-2">
                  Start by adding a note
                </AlertDescription>
              </Alert>
            )}
            {notes?.map((note) => (
              <>
                <div
                  key={note.id}
                  className="flex flex-row items-center justify-between w-full p-4"
                >
                  <div className="flex flex-row gap-2">
                    <span>{note.content}</span>
                  </div>
                  <Button variant="ghost" onClick={() => deleteNote(note.id)}>
                    <Trash className="w-5 h-5" />
                  </Button>
                </div>
                <Separator className="last:hidden" />
              </>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
