"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface CategoryItem {
  id: string;
  name: string;
}

interface CategoryPill {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
}

interface UnsubscriberRow {
  id: string;
  email: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  categories: CategoryPill[];
  hasGlobal: boolean;
  latestAt: string;
  latestCampaignName: string | null;
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500",
  "bg-yellow-500", "bg-cyan-500",
];

function getInitials(row: UnsubscriberRow): string {
  const first = row.firstName || "";
  const last = row.lastName || "";
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  const full = row.fullName || row.email || "?";
  return full.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

export default function UnsubscribersPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [rows, setRows] = useState<UnsubscriberRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(""); // "" = all, "all" = global, <id> = specific
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnsubscriberRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) { router.push("/login"); return; }
        const data = await res.json();
        if (data.user.role !== "super_admin") { router.push("/dashboard"); return; }
        setUser(data.user);
      } catch { router.push("/login"); }
    }
    checkAuth();
  }, [router]);

  // Categories
  useEffect(() => {
    if (!user) return;
    async function loadCats() {
      try {
        const res = await fetch("/api/campaign-categories");
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data.categories || []);
      } catch { /* ignore */ }
    }
    loadCats();
  }, [user]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(perPage),
        offset: String((page - 1) * perPage),
      });
      if (searchText) params.set("search", searchText);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      const res = await fetch(`/api/unsubscribers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch unsubscribers");
      const data = await res.json();
      setRows(data.unsubscribers || []);
      setTotalCount(data.count || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [searchText, page, perPage, categoryFilter]);

  useEffect(() => { if (user) fetchRows(); }, [user, fetchRows]);

  const handleSearch = () => { setPage(1); setSearchText(searchInput); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const handleDeleteRow = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({ email: deleteTarget.email });
      const res = await fetch(`/api/unsubscribers?${params}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete");
      }
      toast.success(`Cleared all unsubscribes for ${deleteTarget.email}`);
      fetchRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/unsubscribers", { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to clear");
      }
      const data = await res.json();
      toast.success(
        `Cleared ${data.categoryRows} category opt-out${data.categoryRows === 1 ? "" : "s"} and ${data.unsubscribedEvents} unsubscribed event${data.unsubscribedEvents === 1 ? "" : "s"}.`
      );
      setPage(1);
      fetchRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear");
    } finally {
      setClearing(false);
      setClearOpen(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  if (!user) return null;

  return (
    <div className="flex flex-col -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 -mt-16 lg:-mt-8 h-screen">
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-4 border-b bg-background">
        <h1 className="text-xl font-semibold">
          Unsubscribers{" "}
          {!loading && (
            <span className="text-muted-foreground font-normal">
              ({totalCount.toLocaleString()})
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <Select
            value={categoryFilter || "__any"}
            onValueChange={(v) => {
              setPage(1);
              const next = v ?? "__any";
              setCategoryFilter(next === "__any" ? "" : next);
            }}
          >
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="All unsubscribers">
                {(value) => {
                  if (!value || value === "__any") return "All unsubscribers";
                  if (value === "all") return "Unsubscribed from all";
                  const c = categories.find((x) => x.id === value);
                  return c ? c.name : "Filter by category";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any">All unsubscribers</SelectItem>
              <SelectItem value="all">Unsubscribed from all</SelectItem>
              {categories.length > 0 && (
                <>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email..."
              className="pl-8 h-9 w-[240px]"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => { setPage(1); handleSearch(); }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-9"
            onClick={() => setClearOpen(true)}
            disabled={loading || clearing || totalCount === 0}
            title="Test/Dev — wipes every unsubscribe record"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear All (Test/Dev)
          </Button>
        </div>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resubscribe this email?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears every unsubscribe state for{" "}
              <strong>{deleteTarget?.email}</strong> — both the global &quot;all
              emails&quot; opt-out (if any) and every category-specific opt-out.
              Future campaigns will be able to send to this address again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteRow}
              disabled={deleting}
            >
              {deleting ? "Clearing..." : "Yes, resubscribe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all unsubscribers?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a <strong>test / dev</strong> action. It will permanently delete
              every category opt-out and every &quot;unsubscribed&quot; campaign event in
              the database. Recipients will no longer be suppressed by their previous
              choices. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearing}
            >
              {clearing ? "Clearing..." : "Yes, clear everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 min-h-0 bg-card overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            {searchText || categoryFilter
              ? "No unsubscribers match your filters."
              : "No unsubscribers yet."}
          </div>
        ) : (
          <table className="w-full caption-bottom text-sm">
            <thead className="sticky top-0 z-10 [&_tr]:border-b">
              <tr className="border-b bg-muted/80">
                <th className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/80">
                  Contact
                </th>
                <th className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/80">
                  Email
                </th>
                <th className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/80">
                  Unsubscribed From
                </th>
                <th className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/80">
                  Source Campaign
                </th>
                <th className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/80">
                  Unsubscribed
                </th>
                <th className="h-10 px-2 text-right align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/80 w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {rows.map((row) => {
                const name =
                  row.fullName ||
                  [row.firstName, row.lastName].filter(Boolean).join(" ") ||
                  row.email;
                const initials = getInitials(row);
                const color = getAvatarColor(name);

                return (
                  <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-2 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full ${color} flex items-center justify-center`}>
                          <span className="text-xs font-semibold text-white">{initials}</span>
                        </div>
                        <span className="font-medium">
                          {name === row.email ? (
                            <span className="text-muted-foreground/80">—</span>
                          ) : (
                            name
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap text-sm">{row.email}</td>
                    <td className="p-2 align-middle text-sm">
                      <div className="flex flex-wrap items-center gap-1 max-w-[420px]">
                        {row.hasGlobal && (
                          <Badge variant="destructive" className="text-[10px]">
                            All emails
                          </Badge>
                        )}
                        {row.categories.map((c) => (
                          <Badge
                            key={c.id}
                            variant="secondary"
                            className="text-[10px] font-mono"
                            title={c.name}
                          >
                            {c.slug}
                          </Badge>
                        ))}
                        {!row.hasGlobal && row.categories.length === 0 && (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap text-sm text-muted-foreground">
                      {row.latestCampaignName || (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap text-sm text-muted-foreground">
                      {timeAgo(row.latestAt)}
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap text-right w-16">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Clear all unsubscribes for this email (resubscribes them)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-t bg-background">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing</span>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>of {totalCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 text-sm"
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </Button>
              )
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
