"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────
interface Contact {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

interface ColumnConfig {
  label: string;
  name: string;
  visible: boolean;
}

// ─── Column definitions ─────────────────────────────────
const ALL_COLUMNS: { label: string; name: string }[] = [
  { label: "Full Name", name: "fullName" },
  { label: "Email", name: "email" },
  { label: "First Name", name: "firstName" },
  { label: "Last Name", name: "lastName" },
  { label: "Tags", name: "tags" },
  { label: "Phone Number", name: "phone" },
  { label: "Birthday", name: "birthday" },
  { label: "Gender", name: "gender" },
  { label: "Occupation", name: "occupation" },
  { label: "Language", name: "language" },
  { label: "Timezone", name: "timezone" },
  { label: "Country", name: "country" },
  { label: "Address", name: "address" },
  { label: "Website", name: "website" },
  { label: "LinkedIn", name: "linkedin" },
  { label: "Facebook", name: "facebook" },
  { label: "Twitter", name: "twitter" },
  { label: "Browser", name: "browser" },
  { label: "Device", name: "device" },
  { label: "Contact Source", name: "contactSource" },
  { label: "Job Title", name: "jobTitle" },
  { label: "Department", name: "department" },
  { label: "Annual Income", name: "annualIncome" },
  { label: "Annual Revenue", name: "annualRevenue" },
  { label: "Customer Lifetime Value", name: "customerLifetimeValue" },
  { label: "Team Size", name: "teamSize" },
  { label: "NPS Score", name: "nps_score" },
  { label: "Is Marketing Allowed", name: "is_marketing_allowed" },
  { label: "Is Verified", name: "is_verified" },
  { label: "Email Status", name: "email_status" },
  { label: "Email Verification Status", name: "email_verification_status" },
  { label: "Email Marketing Consent", name: "marketing_email_subscription_status" },
  { label: "Marketing Contact Status", name: "marketing_contact_status" },
  { label: "event_type", name: "event_type" },
  { label: "plugin_id", name: "plugin_id" },
  { label: "plugin_slug", name: "plugin_name" },
  { label: "product_name", name: "product_name" },
  { label: "platform", name: "platform" },
  { label: "feed", name: "feed" },
  { label: "Orders Count", name: "orders_count" },
  { label: "Total Spent", name: "total_spent" },
  { label: "Average Order Value", name: "average_order_value" },
  { label: "First Purchase Date", name: "first_purchase_date" },
  { label: "Last Purchase Date", name: "last_purchase_date" },
  { label: "Last Abandoned Date", name: "last_abandoned_date" },
  { label: "MRR", name: "mrr" },
  { label: "Subscription Activated Date", name: "subscription_activated_date" },
  { label: "Subscription Created Date", name: "subscription_created_date" },
  { label: "Subscription Cancelled Date", name: "subscription_cancelled_date" },
  { label: "Trial Start Date", name: "trial_start_date" },
  { label: "Trial End Date", name: "trial_end_date" },
  { label: "Next Billing Date", name: "next_billing_date" },
  { label: "Last Activity Date", name: "lastActivityDate" },
  { label: "uninstall_feedback", name: "uninstall_feedback" },
  { label: "uninstall_reason_id", name: "uninstall_reason_id" },
  { label: "feedback_text", name: "feedback_text" },
  { label: "Created Date", name: "createdAt" },
  { label: "Last Updated Date", name: "updatedAt" },
];

const DEFAULT_VISIBLE = [
  "fullName", "email", "plugin_name", "tags", "createdAt",
  "is_marketing_allowed", "marketing_email_subscription_status", "country",
];

const CURRENCY_FIELDS = new Set([
  "annualIncome", "annualRevenue", "customerLifetimeValue",
  "total_spent", "average_order_value", "mrr",
]);

const DATE_FIELDS = new Set([
  "birthday", "createdAt", "updatedAt", "lastActivityDate",
  "first_purchase_date", "last_purchase_date", "last_abandoned_date",
  "subscription_activated_date", "subscription_created_date",
  "subscription_cancelled_date", "trial_start_date", "trial_end_date",
  "next_billing_date",
]);

const STORAGE_KEY = "contacts-column-config-v2";

function loadColumnConfig(): ColumnConfig[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveColumnConfig(columns: ColumnConfig[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(columns)); } catch { /* ignore */ }
}

// ─── Avatar colors ───────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500",
  "bg-yellow-500", "bg-cyan-500",
];

function getInitials(contact: Contact): string {
  const first = (contact.firstName as string) || "";
  const last = (contact.lastName as string) || "";
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  const full = (contact.fullName as string) || (contact.email as string) || "?";
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

// ─── Component ───────────────────────────────────────────
export default function ContactsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchText, setSearchText] = useState("");
  const [unsubscribedOnly, setUnsubscribedOnly] = useState(false);
  const [subscribersOnly, setSubscribersOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", firstName: "", lastName: "" });

  // ─── Auth ──────────────────────────────────────────────
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

  // ─── Columns ───────────────────────────────────────────
  useEffect(() => {
    const saved = loadColumnConfig();
    if (saved && saved.length > 0) {
      const savedNames = new Set(saved.map((c) => c.name));
      const merged = [
        ...saved.filter((s) => ALL_COLUMNS.some((a) => a.name === s.name)),
        ...ALL_COLUMNS.filter((a) => !savedNames.has(a.name)).map((a) => ({ ...a, visible: false })),
      ];
      setColumns(merged);
    } else {
      setColumns(ALL_COLUMNS.map((col) => ({ ...col, visible: DEFAULT_VISIBLE.includes(col.name) })));
    }
  }, []);

  useEffect(() => { if (columns.length > 0) saveColumnConfig(columns); }, [columns]);

  // ─── Fetch ─────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(perPage), offset: String((page - 1) * perPage) });
      if (searchText) params.set("search", searchText);
      if (unsubscribedOnly) params.set("unsubscribed", "true");
      if (subscribersOnly) params.set("subscribers", "true");
      const res = await fetch(`/api/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const data = await res.json();
      setContacts(data.contacts || []);
      setTotalCount(data.count || 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  }, [searchText, page, perPage, unsubscribedOnly, subscribersOnly]);

  useEffect(() => { if (user) fetchContacts(); }, [user, fetchContacts]);

  // ─── Search ────────────────────────────────────────────
  const handleSearch = () => { setPage(1); setSearchText(searchInput); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  // ─── Add contact ───────────────────────────────────────
  const handleAddContact = async () => {
    if (!addForm.email) { toast.error("Email is required"); return; }
    setAddLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success("Contact created");
      setAddOpen(false);
      setAddForm({ email: "", firstName: "", lastName: "" });
      fetchContacts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally { setAddLoading(false); }
  };

  // ─── Selection ─────────────────────────────────────────
  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const toggleAll = () => {
    if (allSelected) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(contacts.map((c) => c.id))); }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Columns controls ─────────────────────────────────
  const toggleColumn = (name: string) =>
    setColumns((prev) => prev.map((col) => col.name === name ? { ...col, visible: !col.visible } : col));

  const moveColumn = (index: number, direction: "up" | "down") => {
    setColumns((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    setColumns((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const showAllColumns = () => setColumns((prev) => prev.map((col) => ({ ...col, visible: true })));
  const hideAllColumns = () => setColumns((prev) => prev.map((col) => ({ ...col, visible: false })));
  const resetColumns = () =>
    setColumns((prev) => prev.map((col) => ({ ...col, visible: DEFAULT_VISIBLE.includes(col.name) })));

  const visibleColumns = columns.filter((col) => col.visible);

  // ─── Long-press column drag ───────────────────────────
  const [headerDrag, setHeaderDrag] = useState<{ colName: string; startX: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onHeaderPointerDown = useCallback((e: React.PointerEvent, colName: string) => {
    clearLongPress();
    const startX = e.clientX;
    longPressTimerRef.current = setTimeout(() => {
      setHeaderDrag({ colName, startX });
      longPressTimerRef.current = null;
    }, 500);
  }, [clearLongPress]);

  const onHeaderPointerUp = useCallback(() => {
    clearLongPress();
    setHeaderDrag(null);
  }, [clearLongPress]);

  const onHeaderPointerMove = useCallback((e: React.PointerEvent) => {
    if (!headerDrag) {
      // If still waiting for long-press, cancel if moved too far
      clearLongPress();
      return;
    }

    const currentX = e.clientX;
    const draggedTh = thRefs.current.get(headerDrag.colName);
    if (!draggedTh) return;

    const draggedRect = draggedTh.getBoundingClientRect();
    const draggedIdx = visibleColumns.findIndex((c) => c.name === headerDrag.colName);

    // Check if cursor moved into an adjacent column
    if (currentX < draggedRect.left && draggedIdx > 0) {
      const prevCol = visibleColumns[draggedIdx - 1];
      // Swap in the full columns array
      setColumns((prev) => {
        const next = [...prev];
        const fromIdx = next.findIndex((c) => c.name === headerDrag.colName);
        const toIdx = next.findIndex((c) => c.name === prevCol.name);
        if (fromIdx === -1 || toIdx === -1) return prev;
        [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
        return next;
      });
    } else if (currentX > draggedRect.right && draggedIdx < visibleColumns.length - 1) {
      const nextCol = visibleColumns[draggedIdx + 1];
      setColumns((prev) => {
        const next = [...prev];
        const fromIdx = next.findIndex((c) => c.name === headerDrag.colName);
        const toIdx = next.findIndex((c) => c.name === nextCol.name);
        if (fromIdx === -1 || toIdx === -1) return prev;
        [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
        return next;
      });
    }
  }, [headerDrag, visibleColumns, clearLongPress, setColumns]);

  // Clean up on unmount
  useEffect(() => {
    return () => clearLongPress();
  }, [clearLongPress]);

  // Global pointer up listener to end drag even if pointer leaves the header
  useEffect(() => {
    if (!headerDrag) return;
    const handleUp = () => setHeaderDrag(null);
    window.addEventListener("pointerup", handleUp);
    return () => window.removeEventListener("pointerup", handleUp);
  }, [headerDrag]);

  // ─── Pagination ────────────────────────────────────────
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

  // ─── Format cell ───────────────────────────────────────
  const formatCellValue = (contact: Contact, columnName: string): React.ReactNode => {
    const value = contact[columnName];

    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground/50">—</span>;
    }

    // Tags
    if (columnName === "tags") {
      try {
        const tags: string[] = typeof value === "string" ? JSON.parse(value) : Array.isArray(value) ? value : [];
        if (tags.length === 0) return <span className="text-muted-foreground/50">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{tag}</span>
            ))}
            {tags.length > 2 && <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>}
          </div>
        );
      } catch { return String(value); }
    }

    // Address
    if (columnName === "address" && typeof value === "object" && value !== null) {
      const addr = value as Record<string, string>;
      const parts = [addr.city, addr.country].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : <span className="text-muted-foreground/50">—</span>;
    }

    // Date fields
    if (DATE_FIELDS.has(columnName)) {
      try {
        const d = new Date(value as string);
        if (isNaN(d.getTime())) return String(value);
        if (columnName === "createdAt" || columnName === "updatedAt" || columnName === "lastActivityDate") {
          return <span className="text-muted-foreground">{timeAgo(value as string)}</span>;
        }
        return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      } catch { return String(value); }
    }

    // Currency
    if (CURRENCY_FIELDS.has(columnName)) {
      const num = Number(value);
      if (isNaN(num) || num === 0) return <span className="text-muted-foreground/50">—</span>;
      return `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }

    // Numbers
    if (typeof value === "number") {
      return value === 0 ? <span className="text-muted-foreground/50">0</span> : value.toLocaleString();
    }

    // Status badges
    if (columnName === "email_verification_status") {
      const colors: Record<string, string> = {
        valid: "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400",
        invalid: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400",
        pending: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400",
        unknown: "text-muted-foreground bg-muted",
      };
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase ${colors[value as string] || colors.unknown}`}>
          {String(value)}
        </span>
      );
    }
    if (columnName === "marketing_email_subscription_status") {
      const isSubscribed = value === "subscribed";
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase ${isSubscribed ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400" : "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400"}`}>
          {String(value)}
        </span>
      );
    }
    if (columnName === "marketing_contact_status") {
      const isMkt = value === "marketing_contact";
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isMkt ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400" : "text-muted-foreground bg-muted"}`}>
          {isMkt ? "Marketing" : "Non-Marketing"}
        </span>
      );
    }
    if (columnName === "is_marketing_allowed" || columnName === "is_verified") {
      const isTrue = value === "true" || value === true;
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isTrue ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400" : "text-muted-foreground bg-muted"}`}>
          {isTrue ? "Yes" : "No"}
        </span>
      );
    }
    if (columnName === "email_status") {
      const colors: Record<string, string> = {
        active: "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400",
        bounced: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400",
      };
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase ${colors[value as string] || "text-muted-foreground bg-muted"}`}>
          {String(value)}
        </span>
      );
    }

    // Booleans
    if (typeof value === "boolean") {
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${value ? "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400" : "text-muted-foreground bg-muted"}`}>
          {value ? "Yes" : "No"}
        </span>
      );
    }

    // URLs
    if (columnName === "website" || columnName === "linkedin" || columnName === "facebook" || columnName === "twitter") {
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block max-w-[180px] text-sm">
          {String(value).replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      );
    }

    // Full name fallback
    if (columnName === "fullName" && !value) {
      const composed = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      return composed || <span className="text-muted-foreground/50">—</span>;
    }

    return <span className="truncate block max-w-[200px]">{String(value)}</span>;
  };

  if (!user) return null;

  return (
    <div className="flex flex-col -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 -mt-16 lg:-mt-8 h-screen">
      {/* ── Header (pinned) ────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-4 border-b bg-background">
        <h1 className="text-xl font-semibold">
          All Contacts{" "}
          {!loading && <span className="text-muted-foreground font-normal">({totalCount.toLocaleString()})</span>}
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="pl-8 h-9 w-[240px]"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap">
            <Checkbox
              checked={subscribersOnly}
              onCheckedChange={(v) => { setSubscribersOnly(!!v); if (v) setUnsubscribedOnly(false); setPage(1); }}
            />
            Subscribers only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap">
            <Checkbox
              checked={unsubscribedOnly}
              onCheckedChange={(v) => { setUnsubscribedOnly(!!v); if (v) setSubscribersOnly(false); setPage(1); }}
            />
            Unsubscribed only
          </label>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { setPage(1); handleSearch(); }}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {/* Columns popover */}
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" className="h-9"><SlidersHorizontal className="h-4 w-4 mr-1.5" />Columns</Button>} />
            <PopoverContent align="end" className="w-80 max-h-[480px] overflow-hidden flex flex-col p-0">
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="text-sm font-medium">Toggle columns</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={showAllColumns}>All</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={hideAllColumns}>None</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetColumns}>Reset</Button>
                </div>
              </div>
              <Separator />
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="columns">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="overflow-y-auto flex-1 px-1 py-1">
                      {columns.map((col, index) => (
                        <Draggable key={col.name} draggableId={col.name} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${snapshot.isDragging ? "bg-accent shadow-md ring-1 ring-border" : ""}`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              </div>
                              <Checkbox checked={col.visible} onCheckedChange={() => toggleColumn(col.name)} />
                              <span className="flex-1 truncate">{col.label}</span>
                              <div className="flex shrink-0">
                                <button type="button" onClick={(e) => { e.stopPropagation(); moveColumn(index, "up"); }} disabled={index === 0}
                                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); moveColumn(index, "down"); }} disabled={index === columns.length - 1}
                                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </PopoverContent>
          </Popover>

          {/* Add contact */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button size="sm" className="h-9"><Plus className="h-4 w-4 mr-1.5" />Add Contact</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Contact</DialogTitle>
                <DialogDescription>Create a new contact manually.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-email">Email *</Label>
                  <Input id="add-email" type="email" placeholder="contact@example.com" value={addForm.email}
                    onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-first">First Name</Label>
                    <Input id="add-first" placeholder="John" value={addForm.firstName}
                      onChange={(e) => setAddForm((p) => ({ ...p, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-last">Last Name</Label>
                    <Input id="add-last" placeholder="Doe" value={addForm.lastName}
                      onChange={(e) => setAddForm((p) => ({ ...p, lastName: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleAddContact} disabled={addLoading}>
                  {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Contact
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Table (scrollable middle) ─────────────────── */}
      <div className="flex-1 min-h-0 bg-card overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading contacts...</span>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            {searchText ? "No contacts found matching your search." : "No contacts yet. Click \"Add Contact\" to create one."}
          </div>
        ) : (
          <table className="w-full caption-bottom text-sm">
            <thead className="sticky top-0 z-10 [&_tr]:border-b">
              <tr className="border-b bg-muted/80 hover:bg-muted/80 transition-colors" onPointerMove={onHeaderPointerMove}>
                <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground w-10 bg-muted/80">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </th>
                {visibleColumns.map((col) => (
                  <th
                    key={col.name}
                    ref={(el) => { if (el) thRefs.current.set(col.name, el); else thRefs.current.delete(col.name); }}
                    className={`h-10 px-2 text-left align-middle whitespace-nowrap text-xs font-semibold uppercase tracking-wider bg-muted/80 select-none ${
                      headerDrag?.colName === col.name
                        ? "text-primary bg-primary/10 cursor-grabbing"
                        : "text-muted-foreground cursor-default"
                    }`}
                    onPointerDown={(e) => onHeaderPointerDown(e, col.name)}
                    onPointerUp={onHeaderPointerUp}
                    onPointerLeave={() => { if (!headerDrag) clearLongPress(); }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {contacts.map((contact) => {
                const name = (contact.fullName as string) || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || (contact.email as string) || "";
                const initials = getInitials(contact);
                const color = getAvatarColor(name);
                const isSelected = selectedIds.has(contact.id);

                return (
                  <tr key={contact.id} className={`border-b transition-colors hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}>
                    <td className="p-2 align-middle whitespace-nowrap w-10">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(contact.id)} />
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.name} className="p-2 align-middle whitespace-nowrap text-sm">
                        {col.name === "fullName" ? (
                          <div className="flex items-center gap-3">
                            <div className={`flex-shrink-0 h-8 w-8 rounded-full ${color} flex items-center justify-center`}>
                              <span className="text-xs font-semibold text-white">{initials}</span>
                            </div>
                            <span className="font-medium">{formatCellValue(contact, col.name)}</span>
                          </div>
                        ) : (
                          formatCellValue(contact, col.name)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination footer (pinned) ───────────────── */}
      {!loading && contacts.length > 0 && (
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
