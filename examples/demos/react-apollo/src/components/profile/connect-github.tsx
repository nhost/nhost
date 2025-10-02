import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { useAuth } from "@/providers/auth";
import { useProviderLink } from "@/hooks";
import { useNhostClient } from "@/providers/nhost";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function ConnectGithub() {
  const { session } = useAuth();
  const nhost = useNhostClient();

  const github = useProviderLink("github", {
    connect: session?.accessToken,
    redirectTo: `${window.location.origin}/profile`,
  });

  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAuthUserProviders = async () => {
      setIsLoading(true);
      try {
        const response = await nhost.graphql.request<{
          authUserProviders: {
            id: string;
            providerId: string;
          }[];
        }>({
          query: `
            query getAuthUserProviders {
              authUserProviders {
                id
                providerId
              }
            }
          `,
        });
        if (response.body.data?.authUserProviders) {
          setIsGithubConnected(
            response.body.data.authUserProviders.some(
              (item: { providerId: string }) => item.providerId === "github",
            ),
          );
        }
      } catch (error) {
        console.error("Failed to fetch auth user providers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuthUserProviders();
  }, [nhost]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Connect with Github</CardTitle>
      </CardHeader>
      <CardContent>
        {!isLoading && isGithubConnected && (
          <div className="flex flex-row items-center gap-2 w-fit">
            <SiGithub className="w-4 h-4" />
            <span className="flex-1 text-center">Github connected</span>
          </div>
        )}

        {!isLoading && !isGithubConnected && (
          <Link
            to={github}
            className={cn(
              buttonVariants({ variant: "link" }),
              "bg-[#131111] text-white hover:opacity-90 hover:no-underline gap-2",
            )}
          >
            <SiGithub className="w-4 h-4" />
            <span className="flex-1 text-center">Continue with Github</span>
          </Link>
        )}

        {isLoading && <LoaderCircle className="w-5 h-5 animate-spin-fast" />}
      </CardContent>
    </Card>
  );
}
