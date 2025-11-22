import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth";
import { useNhostClient } from "@/providers/nhost";
import { useSecurity } from "@/hooks";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export const ChangeEmail: React.FC = () => {
  const nhost = useNhostClient();
  const { user } = useAuth();
  const { requiresElevation, checkElevation } = useSecurity();

  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setNewEmail(user.email);
    }
  }, [user?.email]);

  const change = async () => {
    if (!newEmail.trim()) {
      toast.error("Please enter a new email address");
      return;
    }

    if (newEmail && user?.email === newEmail) {
      toast.error("You need to set a different email as the current one");
      return;
    }

    if (requiresElevation) {
      try {
        await checkElevation();
      } catch {
        toast.error("Could not elevate permissions");
        return;
      }
    }

    setIsLoading(true);
    try {
      await nhost.auth.changeUserEmail({
        newEmail,
        options: {
          redirectTo: `${window.location.origin}/profile`,
        },
      });

      toast.info(
        "Please check your inbox and follow the link to confirm the email change.",
      );
      setNewEmail(user?.email || "");
    } catch (error) {
      console.error("Failed to change email:", error);
      toast.error("Failed to change email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Change email</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="New email"
          />
          <Button onClick={change} disabled={isLoading}>
            {isLoading ? "Changing..." : "Change"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
