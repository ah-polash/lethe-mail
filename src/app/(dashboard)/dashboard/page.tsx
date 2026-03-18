"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Mail, Eye, Plus, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
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

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalSent: number;
  totalOpened: number;
  createdAt: string;
}

interface Stats {
  totalCampaigns: number;
  totalSent: number;
  totalOpened: number;
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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0,
    totalSent: 0,
    totalOpened: 0,
  });
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/campaigns");
        if (res.ok) {
          const data = await res.json();
          const campaigns: Campaign[] = data.campaigns || [];
          setRecentCampaigns(campaigns.slice(0, 5));
          setStats({
            totalCampaigns: campaigns.length,
            totalSent: campaigns.reduce(
              (sum: number, c: Campaign) => sum + (c.totalSent || 0),
              0
            ),
            totalOpened: campaigns.reduce(
              (sum: number, c: Campaign) => sum + (c.totalOpened || 0),
              0
            ),
          });
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your email marketing activity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Campaigns
            </CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.totalCampaigns}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.totalSent.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Opened</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.totalOpened.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link href="/campaigns/new" className={cn(buttonVariants())}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
        </Link>
        <Link href="/templates/new" className={cn(buttonVariants({ variant: "outline" }))}>
            <FileText className="mr-2 h-4 w-4" />
            New Template
        </Link>
      </div>

      {/* Recent Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>Your latest 5 campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Loading...
            </p>
          ) : recentCampaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No campaigns yet. Create your first campaign to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="hover:underline"
                      >
                        {campaign.name}
                      </Link>
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
                      {(campaign.totalSent || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(campaign.totalOpened || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(campaign.createdAt).toLocaleDateString()}
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
