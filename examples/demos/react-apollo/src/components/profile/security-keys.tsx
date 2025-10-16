import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Info, Plus, Trash } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/providers/auth";
import { useNhostClient } from "@/providers/nhost";
import { useSecurity } from "@/hooks";

type SecurityKey = {
  id: string;
  nickname?: string | undefined;
};

type SecurityKeysQuery = {
  authUserSecurityKeys: SecurityKey[];
};

const addSecurityKeySchema = z.object({
  nickname: z.string().min(1),
});

export default function SecurityKeys() {
  const { user } = useAuth();
  const nhost = useNhostClient();

  const [keys, setKeys] = useState<SecurityKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSecurityKeyDialog, setShowAddSecurityDialog] = useState(false);
  const { isElevated, checkElevation } = useSecurity();

  const fetchSecurityKeys = useCallback(async () => {
    try {
      setLoading(true);
      const response = await nhost.graphql.request<SecurityKeysQuery>({
        query: `
            query securityKeys($userId: uuid!) {
              authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
                id
                nickname
              }
            }
          `,
        variables: { userId: user?.id },
      });

      if (response.body.data?.authUserSecurityKeys) {
        setKeys(response.body.data.authUserSecurityKeys || []);
      }
    } catch (error) {
      toast.error("Failed to load security keys: ${error}", error || {});
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql, user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchSecurityKeys();
    }
  }, [user?.id, fetchSecurityKeys]);

  const form = useForm<z.infer<typeof addSecurityKeySchema>>({
    resolver: zodResolver(addSecurityKeySchema),
    defaultValues: {
      nickname: "",
    },
  });

  const elevatePermissionIfNeeded = async () => {
    if (!isElevated && keys.length > 0) {
      try {
        await checkElevation();
      } catch {
        toast.error("Could not elevate permissions");
        return false;
      }
    }

    return { success: true, elevatedToken: null }; // return success if already elevated or no keys
  };

  const onSubmit = async (values: z.infer<typeof addSecurityKeySchema>) => {
    const { nickname } = values;

    const elevationResult = await elevatePermissionIfNeeded();

    if (!elevationResult || !elevationResult.success) {
      return;
    }

    const webAuthnOptions = await nhost.auth.addSecurityKey();
    const credential = await startRegistration(webAuthnOptions.body);
    const result = await nhost.auth.verifyAddSecurityKey({
      credential,
      nickname,
    });

    if (!result.body) {
      // toast.error(error?.message)
      toast.error("Failed to add security key");
    } else if (result.body) {
      setKeys((previousKeys) => [...previousKeys, result.body]);
      setShowAddSecurityDialog(false);
      form.reset();

      await fetchSecurityKeys();
    }
  };

  const handleDeleteSecurityKey = async (id: string) => {
    const elevationResult = await elevatePermissionIfNeeded();

    if (!elevationResult || !elevationResult.success) {
      return;
    }

    try {
      const response = await nhost.graphql.request({
        query: `
          mutation removeSecurityKey($id: uuid!) {
            deleteAuthUserSecurityKey(id: $id) {
              id
            }
          }
        `,
        variables: { id },
      });

      if (response.body?.errors) {
        throw new Error("Failed to delete security key");
      }

      setKeys((prevKeys) => prevKeys.filter((key) => key.id !== id));
      toast.success("Security key removed successfully");
    } catch (error) {
      console.error("Error deleting security key:", error);
      toast.error("Failed to delete security key");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <CardTitle>Security keys</CardTitle>
          <Button
            className="m-0"
            onClick={() => setShowAddSecurityDialog(true)}
          >
            <Plus />
            Add
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <div className="text-sm text-muted-foreground">
                Loading security keys...
              </div>
            </div>
          ) : keys.length === 0 ? (
            <Alert className="w-full">
              <Info className="w-4 h-4" />
              <AlertTitle>No security keys</AlertTitle>
              <AlertDescription className="mt-2">
                You can add a security key by clicking <b>Add</b>
              </AlertDescription>
            </Alert>
          ) : null}
          {!loading && (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-row items-center justify-between w-full px-4 py-2 border rounded-md"
                >
                  <div className="flex flex-row gap-2">
                    <Fingerprint />
                    <span className="">{key.nickname || key.id}</span>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => handleDeleteSecurityKey(key.id)}
                  >
                    <Trash />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showAddSecurityKeyDialog}
        onOpenChange={(open) => setShowAddSecurityDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New security key</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col w-full space-y-4"
            >
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="nickname" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <Button type="submit">Create</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
