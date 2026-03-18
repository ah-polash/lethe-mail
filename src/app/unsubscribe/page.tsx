"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const campaignId = searchParams.get("campaignId");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function unsubscribe() {
      if (!email) {
        setStatus("error");
        setMessage("Invalid unsubscribe link.");
        return;
      }

      try {
        const params = new URLSearchParams({ email, campaignId: campaignId || "" });
        const res = await fetch(`/api/unsubscribe?${params.toString()}`);

        if (res.ok) {
          setStatus("success");
          setMessage("You have been successfully unsubscribed.");
        } else {
          const data = await res.json();
          setStatus("error");
          setMessage(data.error || "Failed to unsubscribe. Please try again.");
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again later.");
      }
    }

    unsubscribe();
  }, [email, campaignId]);

  return (
    <>
      {status === "loading" && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Processing your request...</p>
        </div>
      )}
      {status === "success" && (
        <div className="flex flex-col items-center gap-3">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-lg font-medium">{message}</p>
          <p className="text-sm text-muted-foreground">
            You will no longer receive emails from this sender.
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">Oops!</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      )}
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            bPlugins
          </CardTitle>
          <CardDescription>Email Preferences</CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          <Suspense
            fallback={
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            }
          >
            <UnsubscribeContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
