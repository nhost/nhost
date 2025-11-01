import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { gql, useMutation } from "@apollo/client";
import { Check, Info, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNhostClient } from "@/providers/nhost";

export default function Todos() {
  const nhost = useNhostClient();
  const [todos, setTodos] = useState<
    {
      id: string;
      contents: string;
    }[]
  >([]);

  const refetchTodos = async () => {
    const response = await nhost.graphql.request<{
      todos: {
        id: string;
        contents: string;
      }[];
    }>({
      query: `
        {
          todos(order_by: { createdAt: desc }) {
            id
            contents
          }
        }
      `,
    });
    setTodos(response.body.data?.todos || []);
  };

  const [contents, setContents] = useState("");

  const [addTodo] = useMutation<{
    insertTodo?: {
      id: string;
      contents: string;
    };
  }>(gql`
    mutation ($contents: String!) {
      insertTodo(object: { contents: $contents }) {
        id
        contents
      }
    }
  `);

  const [deleteTodo] = useMutation<{
    deleteNote?: {
      id: string;
      content: string;
    };
  }>(gql`
    mutation deleteTodo($todoId: uuid!) {
      deleteTodo(id: $todoId) {
        id
        contents
      }
    }
  `);

  const handleAddTodo = () => {
    if (contents) {
      addTodo({
        variables: { contents },
        onCompleted: async () => {
          setContents("");
          await refetchTodos();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      });
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    await deleteTodo({
      variables: { todoId },
      onCompleted: async () => {
        await refetchTodos();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

    await refetchTodos();
  };

  return (
    <div className="w-full">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Todos</CardTitle>
        </CardHeader>
      </Card>
      <Card className="w-full pt-6">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-row gap-4">
            <Input
              value={contents}
              onChange={(e) => setContents(e.target.value)}
              onKeyDown={(e) => e.code === "Enter" && handleAddTodo()}
            />
            <Button className="m-0" onClick={handleAddTodo}>
              <Plus />
              Add
            </Button>
          </div>
          <div>
            {todos.length === 0 && (
              <Alert className="w-full">
                <Info className="w-4 h-4" />
                <AlertTitle>Empty</AlertTitle>
                <AlertDescription className="mt-2">
                  Start by adding a todo
                </AlertDescription>
              </Alert>
            )}
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="flex flex-row items-center justify-between w-full p-4 border-b last:pb-0 last:border-b-0"
              >
                <div className="flex flex-row gap-2">
                  <Check className="w-5 h-5" />
                  <span>{todo.contents}</span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteTodo(todo.id)}
                >
                  <Trash className="w-5 h-5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
