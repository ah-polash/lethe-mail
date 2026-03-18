"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

// --- Types ---

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface SesConfig {
  id?: string;
  name: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  configSetName: string;
  isActive?: boolean;
}

interface SwipeOneConfig {
  id?: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  workspaceId: string;
  isActive?: boolean;
}

const emptySes: SesConfig = {
  name: "",
  region: "",
  accessKeyId: "",
  secretAccessKey: "",
  configSetName: "",
};

const emptySwipeone: SwipeOneConfig = {
  name: "",
  apiKey: "",
  baseUrl: "https://api.swipeone.com",
  workspaceId: "",
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // SES
  const [sesConfigs, setSesConfigs] = useState<SesConfig[]>([]);
  const [sesForm, setSesForm] = useState<SesConfig>(emptySes);
  const [sesDialogOpen, setSesDialogOpen] = useState(false);
  const [sesEditing, setSesEditing] = useState(false);
  const [savingSes, setSavingSes] = useState(false);
  const [testingSes, setTestingSes] = useState(false);
  const [showSesAccessKey, setShowSesAccessKey] = useState(false);
  const [showSesSecretKey, setShowSesSecretKey] = useState(false);

  // SwipeOne
  const [swipeoneConfigs, setSwipeoneConfigs] = useState<SwipeOneConfig[]>([]);
  const [swipeoneForm, setSwipeoneForm] = useState<SwipeOneConfig>(emptySwipeone);
  const [swipeoneDialogOpen, setSwipeoneDialogOpen] = useState(false);
  const [swipeoneEditing, setSwipeoneEditing] = useState(false);
  const [savingSwipeone, setSavingSwipeone] = useState(false);
  const [testingSwipeone, setTestingSwipeone] = useState(false);
  const [showSwipeoneApiKey, setShowSwipeoneApiKey] = useState(false);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "general_user",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // --- Data Loading ---

  const loadSesConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/ses");
      if (res.ok) {
        const data = await res.json();
        setSesConfigs(data.configs || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadSwipeoneConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/swipeone");
      if (res.ok) {
        const data = await res.json();
        setSwipeoneConfigs(data.configs || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) { router.push("/login"); return; }
        const data = await res.json();
        if (data.user?.role !== "super_admin") {
          toast.error("Access denied");
          router.push("/dashboard");
          return;
        }
      } catch { router.push("/login"); return; }
      setLoading(false);
    }
    checkAccess();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    loadSesConfigs();
    loadSwipeoneConfigs();
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, [loading, loadSesConfigs, loadSwipeoneConfigs]);

  // --- SES Handlers ---

  const openSesCreate = () => {
    setSesForm(emptySes);
    setSesEditing(false);
    setShowSesAccessKey(false);
    setShowSesSecretKey(false);
    setSesDialogOpen(true);
  };

  const openSesEdit = (config: SesConfig) => {
    setSesForm(config);
    setSesEditing(true);
    setShowSesAccessKey(false);
    setShowSesSecretKey(false);
    setSesDialogOpen(true);
  };

  const handleSaveSes = async () => {
    if (!sesForm.region || !sesForm.accessKeyId || !sesForm.secretAccessKey) {
      toast.error("Region, Access Key, and Secret Key are required");
      return;
    }

    setSavingSes(true);
    try {
      const isEdit = sesEditing && sesForm.id;
      const url = isEdit ? `/api/ses/${sesForm.id}` : "/api/ses";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sesForm),
      });

      if (res.ok) {
        toast.success(isEdit ? "SES configuration updated" : "SES configuration created");
        setSesDialogOpen(false);
        loadSesConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save SES configuration");
      }
    } catch {
      toast.error("Failed to save SES configuration");
    } finally {
      setSavingSes(false);
    }
  };

  const handleDeleteSes = async (id: string) => {
    try {
      const res = await fetch(`/api/ses/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("SES configuration deleted");
        loadSesConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete configuration");
    }
  };

  const handleSetActiveSes = async (id: string) => {
    try {
      const res = await fetch(`/api/ses/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Active SES configuration updated");
        loadSesConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to set active");
      }
    } catch {
      toast.error("Failed to set active configuration");
    }
  };

  const handleTestSes = async () => {
    setTestingSes(true);
    try {
      const res = await fetch("/api/ses", { method: "PUT" });
      if (res.ok) {
        toast.success("SES connection successful!");
      } else {
        const data = await res.json();
        toast.error(data.error || "SES connection failed");
      }
    } catch {
      toast.error("SES connection test failed");
    } finally {
      setTestingSes(false);
    }
  };

  // --- SwipeOne Handlers ---

  const openSwipeoneCreate = () => {
    setSwipeoneForm(emptySwipeone);
    setSwipeoneEditing(false);
    setShowSwipeoneApiKey(false);
    setSwipeoneDialogOpen(true);
  };

  const openSwipeoneEdit = (config: SwipeOneConfig) => {
    setSwipeoneForm(config);
    setSwipeoneEditing(true);
    setShowSwipeoneApiKey(false);
    setSwipeoneDialogOpen(true);
  };

  const handleSaveSwipeone = async () => {
    if (!swipeoneForm.apiKey) {
      toast.error("API key is required");
      return;
    }

    setSavingSwipeone(true);
    try {
      const isEdit = swipeoneEditing && swipeoneForm.id;
      const url = isEdit ? `/api/swipeone/${swipeoneForm.id}` : "/api/swipeone";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(swipeoneForm),
      });

      if (res.ok) {
        toast.success(isEdit ? "SwipeOne configuration updated" : "SwipeOne configuration created");
        setSwipeoneDialogOpen(false);
        loadSwipeoneConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save SwipeOne configuration");
      }
    } catch {
      toast.error("Failed to save SwipeOne configuration");
    } finally {
      setSavingSwipeone(false);
    }
  };

  const handleDeleteSwipeone = async (id: string) => {
    try {
      const res = await fetch(`/api/swipeone/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("SwipeOne configuration deleted");
        loadSwipeoneConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete configuration");
    }
  };

  const handleSetActiveSwipeone = async (id: string) => {
    try {
      const res = await fetch(`/api/swipeone/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Active SwipeOne configuration updated");
        loadSwipeoneConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to set active");
      }
    } catch {
      toast.error("Failed to set active configuration");
    }
  };

  const handleTestSwipeone = async () => {
    setTestingSwipeone(true);
    try {
      const res = await fetch("/api/swipeone", { method: "PUT" });
      if (res.ok) {
        toast.success("SwipeOne connection successful!");
      } else {
        const data = await res.json();
        toast.error(data.error || "SwipeOne connection failed");
      }
    } catch {
      toast.error("SwipeOne connection test failed");
    } finally {
      setTestingSwipeone(false);
    }
  };

  // --- User Handlers ---

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("All fields are required");
      return;
    }
    if (newUser.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("User created");
        setUsers((prev) => [...prev, data.user]);
        setUserDialogOpen(false);
        setNewUser({ name: "", email: "", password: "", role: "general_user" });
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create user");
      }
    } catch {
      toast.error("Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("User deleted");
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        toast.error("Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your platform configuration
        </p>
      </div>

      <Tabs defaultValue="ses">
        <TabsList>
          <TabsTrigger value="ses">SES Connections</TabsTrigger>
          <TabsTrigger value="swipeone">SwipeOne Connections</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>

        {/* ===== SES TAB ===== */}
        <TabsContent value="ses" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Amazon SES Connections</CardTitle>
                  <CardDescription>
                    Manage your SES configurations. The active connection is used for sending emails.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestSes}
                    disabled={testingSes || sesConfigs.every((c) => !c.isActive)}
                  >
                    {testingSes ? "Testing..." : "Test Active"}
                  </Button>
                  <Button onClick={openSesCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sesConfigs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No SES connections configured. Add one to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sesConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell>{config.region}</TableCell>
                        <TableCell>
                          {config.isActive ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Set as active"
                                onClick={() => handleSetActiveSes(config.id!)}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => openSesEdit(config)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => handleDeleteSes(config.id!)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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

          {/* SES Dialog */}
          <Dialog open={sesDialogOpen} onOpenChange={setSesDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{sesEditing ? "Edit SES Connection" : "New SES Connection"}</DialogTitle>
                <DialogDescription>
                  Configure your Amazon SES credentials for sending emails
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="ses-name">Connection Name</Label>
                  <Input
                    id="ses-name"
                    placeholder="e.g. Production, Staging"
                    value={sesForm.name}
                    onChange={(e) => setSesForm({ ...sesForm, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ses-region">AWS Region</Label>
                    <Input
                      id="ses-region"
                      placeholder="us-east-1"
                      value={sesForm.region}
                      onChange={(e) => setSesForm({ ...sesForm, region: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ses-config-set">Config Set Name</Label>
                    <Input
                      id="ses-config-set"
                      placeholder="Optional"
                      value={sesForm.configSetName}
                      onChange={(e) => setSesForm({ ...sesForm, configSetName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ses-access-key">Access Key ID</Label>
                  <div className="relative">
                    <Input
                      id="ses-access-key"
                      type={showSesAccessKey ? "text" : "password"}
                      placeholder="AKIA..."
                      value={sesForm.accessKeyId}
                      onChange={(e) => setSesForm({ ...sesForm, accessKeyId: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSesAccessKey(!showSesAccessKey)}
                    >
                      {showSesAccessKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ses-secret-key">Secret Access Key</Label>
                  <div className="relative">
                    <Input
                      id="ses-secret-key"
                      type={showSesSecretKey ? "text" : "password"}
                      placeholder="Secret key"
                      value={sesForm.secretAccessKey}
                      onChange={(e) => setSesForm({ ...sesForm, secretAccessKey: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSesSecretKey(!showSesSecretKey)}
                    >
                      {showSesSecretKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <Button onClick={handleSaveSes} disabled={savingSes} className="w-full">
                  {savingSes ? "Saving..." : sesEditing ? "Update Connection" : "Create Connection"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== SWIPEONE TAB ===== */}
        <TabsContent value="swipeone" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SwipeOne Connections</CardTitle>
                  <CardDescription>
                    Manage your SwipeOne integrations. The active connection is used for contact segments.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestSwipeone}
                    disabled={testingSwipeone || swipeoneConfigs.every((c) => !c.isActive)}
                  >
                    {testingSwipeone ? "Testing..." : "Test Active"}
                  </Button>
                  <Button onClick={openSwipeoneCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {swipeoneConfigs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No SwipeOne connections configured. Add one to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Base URL</TableHead>
                      <TableHead>Workspace ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {swipeoneConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{config.baseUrl}</TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">
                          {config.workspaceId ? config.workspaceId.slice(0, 12) + "..." : "—"}
                        </TableCell>
                        <TableCell>
                          {config.isActive ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Set as active"
                                onClick={() => handleSetActiveSwipeone(config.id!)}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => openSwipeoneEdit(config)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => handleDeleteSwipeone(config.id!)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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

          {/* SwipeOne Dialog */}
          <Dialog open={swipeoneDialogOpen} onOpenChange={setSwipeoneDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{swipeoneEditing ? "Edit SwipeOne Connection" : "New SwipeOne Connection"}</DialogTitle>
                <DialogDescription>
                  Configure your SwipeOne API credentials
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="so-name">Connection Name</Label>
                  <Input
                    id="so-name"
                    placeholder="e.g. Production, Staging"
                    value={swipeoneForm.name}
                    onChange={(e) => setSwipeoneForm({ ...swipeoneForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="so-api-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="so-api-key"
                      type={showSwipeoneApiKey ? "text" : "password"}
                      placeholder="Your SwipeOne API key"
                      value={swipeoneForm.apiKey}
                      onChange={(e) => setSwipeoneForm({ ...swipeoneForm, apiKey: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSwipeoneApiKey(!showSwipeoneApiKey)}
                    >
                      {showSwipeoneApiKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="so-base-url">Base URL</Label>
                    <Input
                      id="so-base-url"
                      placeholder="https://api.swipeone.com"
                      value={swipeoneForm.baseUrl}
                      onChange={(e) => setSwipeoneForm({ ...swipeoneForm, baseUrl: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="so-workspace-id">Workspace ID</Label>
                    <Input
                      id="so-workspace-id"
                      placeholder="e.g. 6660175570fbd8a9c22bedfb"
                      value={swipeoneForm.workspaceId}
                      onChange={(e) => setSwipeoneForm({ ...swipeoneForm, workspaceId: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find your Workspace ID in your SwipeOne app URL: app.swipeone.com/workspaces/<strong>your-workspace-id</strong>
                </p>
                <Button onClick={handleSaveSwipeone} disabled={savingSwipeone} className="w-full">
                  {savingSwipeone ? "Saving..." : swipeoneEditing ? "Update Connection" : "Create Connection"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== USERS TAB ===== */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage platform users and roles
                  </CardDescription>
                </div>
                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogTrigger render={<Button />}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create User
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        Add a new user to the platform
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-name">Full Name</Label>
                        <Input
                          id="new-name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-email">Email</Label>
                        <Input
                          id="new-email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          minLength={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-role">Role</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(v) => setNewUser({ ...newUser, role: v || "general_user" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general_user">General User</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateUser} disabled={creatingUser} className="w-full">
                        {creatingUser ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No users found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>
                            {user.role === "super_admin" ? "Admin" : "User"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
