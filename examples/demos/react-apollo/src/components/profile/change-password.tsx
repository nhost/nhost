import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNhostClient } from "@/providers/nhost";
import { useSecurity } from "@/hooks";

import { useState } from "react";
import { toast } from "sonner";

export default function ChangePassword() {
  const nhost = useNhostClient();
  const { requiresElevation, checkElevation } = useSecurity();

  const [password, setPassword] = useState("");

  const change = async () => {
    if (requiresElevation) {
      try {
        await checkElevation();
      } catch {
        toast.error("Could not elevate permissions");
        return;
      }
    }

    const result = await nhost.auth.changeUserPassword({
      newPassword: password,
    });

    if (result.body === "OK") {
      toast.success(`Password changed successfully.`);
    }
    if (result.body !== "OK") {
      toast.error(result.body);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row gap-2">
          <Input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
          />
          <Button onClick={change}>Change</Button>
        </div>
      </CardContent>
    </Card>
  );
}
