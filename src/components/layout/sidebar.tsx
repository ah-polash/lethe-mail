"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Send,
  FileText,
  Users,
  Settings,
  LogOut,
  Menu,
  Globe,
  Sparkles,
  ShieldAlert,
  UserMinus,
  Mails,
  Layers,
  MessageSquareWarning,
  Megaphone,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "general_user";
}

interface Brand {
  name: string;
  slogan: string;
  logoUrl: string;
}

const DEFAULT_BRAND: Brand = {
  name: "bPlugins",
  slogan: "Email Marketing",
  logoUrl: "",
};

const navLinks: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  adminOnly?: boolean;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Send, adminOnly: true },
  { href: "/campaigns/swipeone/new", label: "Create Campaign", icon: Globe, exact: true },
  { href: "/sequences", label: "Email Sequence", icon: Mails },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/media", label: "Media Library", icon: ImageIcon },
  { href: "/templates/dynamic", label: "Dynamic Templates", icon: Sparkles, exact: true },
  { href: "/templates/sequence", label: "Sequence Templates", icon: Layers, exact: true },
];

function NavContent({
  user,
  brand,
  onLogout,
}: {
  user: User | null;
  brand: Brand;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <div className="flex items-center gap-2">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-8 w-8 rounded object-contain shrink-0"
            />
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight truncate">{brand.name}</h1>
        </div>
        {brand.slogan ? (
          <p className="text-xs text-muted-foreground mt-1">{brand.slogan}</p>
        ) : null}
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-4">
        {navLinks.map((link) => {
          if (link.adminOnly && user?.role !== "super_admin") return null;
          const Icon = link.icon;
          // If a more-specific link in the list matches the current path, this link is not active.
          const moreSpecific = navLinks.some(
            (other) =>
              other.href !== link.href &&
              other.href.startsWith(link.href + "/") &&
              (pathname === other.href || pathname.startsWith(other.href + "/"))
          );
          const isActive =
            !moreSpecific &&
            (link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(link.href + "/"));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}

        {user?.role === "super_admin" && (
          <>
            <Link
              href="/contacts"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/contacts" || pathname.startsWith("/contacts/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Users className="h-4 w-4" />
              Contacts
            </Link>
            <Link
              href="/unsubscribers"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/unsubscribers" || pathname.startsWith("/unsubscribers/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <UserMinus className="h-4 w-4" />
              Unsubscribers
            </Link>
            <Link
              href="/suppressions"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/suppressions" || pathname.startsWith("/suppressions/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <ShieldAlert className="h-4 w-4" />
              Suppression List
            </Link>
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/settings" || pathname.startsWith("/settings/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 space-y-1">
        <Link
          href="/feedback"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/feedback" || pathname.startsWith("/feedback/")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <MessageSquareWarning className="h-4 w-4" />
          Bug report &amp; Feature request
        </Link>
        <Link
          href="/whats-new"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/whats-new" || pathname.startsWith("/whats-new/")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Megaphone className="h-4 w-4" />
          What&apos;s New
        </Link>
      </div>

      <Separator />

      {user && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {user.role === "super_admin" ? "Admin" : "User"}
              </Badge>
            </div>
            <ThemeToggle />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        // Bulk-created users must set their own password before using the app.
        if (data.user?.mustChangePassword) {
          router.push("/change-password");
          return;
        }
        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  useEffect(() => {
    async function fetchBrand() {
      try {
        const res = await fetch("/api/app-settings");
        if (!res.ok) return;
        const data = await res.json();
        const s = (data.settings || {}) as Record<string, string>;
        setBrand({
          name: s["brand.name"]?.trim() || DEFAULT_BRAND.name,
          slogan: s["brand.slogan"]?.trim() || DEFAULT_BRAND.slogan,
          logoUrl: s["brand.logoUrl"]?.trim() || "",
        });
      } catch { /* keep default */ }
    }
    fetchBrand();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // ignore
    }
    router.push("/login");
  };

  if (loading) {
    return (
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger render={<Button variant="outline" size="icon" />}>
              <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <NavContent user={user} brand={brand} onLogout={handleLogout} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card min-h-screen sticky top-0">
        <NavContent user={user} brand={brand} onLogout={handleLogout} />
      </aside>
    </>
  );
}
