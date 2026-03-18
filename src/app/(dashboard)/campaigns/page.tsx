"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Eye, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  totalRecipients: number;
  totalSent: number;
  totalOpened: number;
  createdAt: string;
}

const statusVariant: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "outline",
  sent: "default",
  failed: "destructive",
};

const statusColors: Record<string, string> = {
  scheduled: "border-blue-500 text-blue-600 dark:text-blue-400",
  sending: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
  sent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Campaign deleted");
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      } else {
        toast.error("Failed to delete campaign");
      }
    } catch {
      toast.error("Failed to delete campaign");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Manage your email campaigns
          </p>
        </div>
        <Link href="/campaigns/new" className={cn(buttonVariants())}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Loading campaigns...
            </p>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm mb-4">
                No campaigns yet
              </p>
              <Link href="/campaigns/new" className={cn(buttonVariants())}>Create your first campaign</Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      {campaign.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[campaign.status] || "secondary"}
                        className={statusColors[campaign.status] || ""}
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(campaign.totalRecipients || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(campaign.totalSent || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(campaign.totalOpened || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {campaign.status === "sent" && (
                          <Link href={`/campaigns/${campaign.id}/report`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                              <Eye className="h-4 w-4" />
                          </Link>
                        )}
                        {campaign.status === "draft" && (
                          <>
                            <Link href={`/campaigns/${campaign.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                                <Pencil className="h-4 w-4" />
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger render={<Button variant="ghost" size="icon" />}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Campaign
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{campaign.name}&quot;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(campaign.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {campaign.status !== "draft" &&
                          campaign.status !== "sent" && (
                            <Link href={`/campaigns/${campaign.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                                <Eye className="h-4 w-4" />
                            </Link>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
