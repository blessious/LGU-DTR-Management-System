import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface AdminFormData {
  name: string;
  username: string;
  password: string;
  level: string;
}

interface Admin {
  id?: number;
  admin_id?: number;
  name: string;
  username: string;
  level: number;
}

function AdminModal({ 
  onAdminUpdated, 
  admin,
  mode = "add"
}: { 
  onAdminUpdated: () => void;
  admin?: Admin;
  mode?: "add" | "edit";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<AdminFormData>({
    name: '',
    username: '',
    password: '',
    level: '2'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      if (mode === "edit" && admin) {
        setFormData({
          name: admin.name || '',
          username: admin.username || '',
          password: '',
          level: admin.level?.toString() || '2'
        });
      } else {
        setFormData({
          name: '',
          username: '',
          password: '',
          level: '2'
        });
      }
      setErrors({});
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Display name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Display name must be at least 2 characters";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (mode === "add" && !formData.password) {
      newErrors.password = "Password is required";
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const adminData: any = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        level: parseInt(formData.level)
      };

      if (formData.password) {
        adminData.password = formData.password;
      }

      if (mode === "add") {
        await api.addAdmin(adminData);
        toast.success("Admin added successfully");
      } else if (mode === "edit" && admin) {
        const adminId = admin.id || admin.admin_id;
        await api.updateAdmin(adminId, adminData);
        toast.success("Admin updated successfully");
      }
      
      onAdminUpdated();
      setOpen(false);
      
      if (mode === "add") {
        setFormData({
          name: '',
          username: '',
          password: '',
          level: '2'
        });
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode === "add" ? "add" : "update"} admin`);
      console.error(`Error ${mode === "add" ? "adding" : "updating"} admin:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!admin) return;

    if (!confirm("Are you sure you want to delete this admin?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      const adminId = admin.id || admin.admin_id;
      await api.deleteAdmin(adminId);
      toast.success("Admin deleted successfully");
      onAdminUpdated();
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete admin");
      console.error("Error deleting admin:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          <Button className="btn-gradient">
            <Plus className="mr-2 h-4 w-4" />
            Add Admin
          </Button>
        ) : (
          <div className="hidden"></div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {mode === "add" ? "Add New Admin" : "Edit Admin"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Display Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter display name"
              className={errors.name ? "border-red-500" : ""}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Username Field */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              Username <span className="text-red-500">*</span>
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter username"
              className={errors.username ? "border-red-500" : ""}
              disabled={loading || mode === "edit"}
            />
            {errors.username && (
              <p className="text-sm text-red-500">{errors.username}</p>
            )}
            {mode === "edit" && (
              <p className="text-xs text-muted-foreground">Username cannot be changed</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password {mode === "add" && <span className="text-red-500">*</span>}
              {mode === "edit" && <span className="text-muted-foreground text-xs">(Leave blank to keep current)</span>}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder={mode === "add" ? "Enter password" : "Enter new password (optional)"}
              className={errors.password ? "border-red-500" : ""}
              disabled={loading}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Privilege Level Field */}
          <div className="space-y-2">
            <Label htmlFor="level" className="text-sm font-medium">
              Privilege Level <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.level}
              onValueChange={(value) => setFormData(prev => ({ ...prev, level: value }))}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Level 1 (View Only)</SelectItem>
                <SelectItem value="2">Level 2 (Standard)</SelectItem>
                <SelectItem value="3">Level 3 (Administrator)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <DialogFooter className="flex justify-between sm:justify-between pt-4">
            {mode === "edit" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLoading || loading}
                className="mr-auto"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            )}
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading || deleteLoading}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleSubmit}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={loading || deleteLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "add" ? "Adding..." : "Updating..."}
                  </>
                ) : (
                  <>
                    {mode === "add" ? (
                      <Plus className="mr-2 h-4 w-4" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {mode === "add" ? "Add Admin" : "Update Admin"}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Admins() {
  const [searchTerm, setSearchTerm] = useState("");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const data = await api.admins();
      setAdmins(data);
    } catch (error) {
      toast.error("Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  const handleRowDoubleClick = (admin: Admin) => {
    setSelectedAdmin(admin);
    setEditModalOpen(true);
  };

  const filteredData = admins.filter((admin: Admin) =>
    admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLevelText = (level: number) => {
    switch (level) {
      case 1: return "View Only";
      case 2: return "Standard";
      case 3: return "Administrator";
      default: return "Unknown";
    }
  };

  const columns = [
    { key: "id", label: "Admin ID" },
    { key: "name", label: "Name" },
    { key: "username", label: "Username" },
    { key: "level", label: "Level" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Admins"
        searchPlaceholder="Search admins..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        actions={
          <AdminModal 
            onAdminUpdated={fetchAdmins} 
            mode="add"
          />
        }
      />

      <div className="p-6">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          renderRow={(admin: Admin, index: number) => (
            <tr
              key={admin.id || admin.admin_id || index}
              className="border-b border-border hover:bg-accent/50 transition-all duration-300 cursor-pointer group"
              onDoubleClick={() => handleRowDoubleClick(admin)}
            >
              <td className="px-6 py-4 text-sm text-card-foreground group-hover:text-primary transition-colors">{admin.id || admin.admin_id || "—"}</td>
              <td className="px-6 py-4 text-sm font-medium text-card-foreground group-hover:text-primary transition-colors">{admin.name || "—"}</td>
              <td className="px-6 py-4 text-sm text-muted-foreground group-hover:text-card-foreground transition-colors">{admin.username || "—"}</td>
              <td className="px-6 py-4 text-sm text-card-foreground group-hover:text-primary transition-colors">{getLevelText(admin.level)}</td>
            </tr>
          )}
        />
      </div>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Admin</DialogTitle>
          </DialogHeader>
          {selectedAdmin && (
            <EditAdminForm
              admin={selectedAdmin}
              onAdminUpdated={() => {
                fetchAdmins();
                setEditModalOpen(false);
              }}
              onCancel={() => setEditModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate form component for edit mode
function EditAdminForm({ 
  admin, 
  onAdminUpdated, 
  onCancel 
}: { 
  admin: Admin;
  onAdminUpdated: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<AdminFormData>({
    name: admin.name || '',
    username: admin.username || '',
    password: '',
    level: admin.level?.toString() || '2'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Display name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Display name must be at least 2 characters";
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const adminData: any = {
        name: formData.name.trim(),
        level: parseInt(formData.level)
      };

      if (formData.password) {
        adminData.password = formData.password;
      }

      const adminId = admin.id || admin.admin_id;
      await api.updateAdmin(adminId, adminData);
      toast.success("Admin updated successfully");
      onAdminUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update admin");
      console.error("Error updating admin:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this admin?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      const adminId = admin.id || admin.admin_id;
      await api.deleteAdmin(adminId);
      toast.success("Admin deleted successfully");
      onAdminUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete admin");
      console.error("Error deleting admin:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Display Name Field */}
      <div className="space-y-2">
        <Label htmlFor="edit-name" className="text-sm font-medium">
          Display Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter display name"
          className={errors.name ? "border-red-500" : ""}
          disabled={loading}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* Username Field */}
      <div className="space-y-2">
        <Label htmlFor="edit-username" className="text-sm font-medium">
          Username
        </Label>
        <Input
          id="edit-username"
          value={formData.username}
          disabled={true}
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">Username cannot be changed</p>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="edit-password" className="text-sm font-medium">
          Password <span className="text-muted-foreground text-xs">(Leave blank to keep current)</span>
        </Label>
        <Input
          id="edit-password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          placeholder="Enter new password (optional)"
          className={errors.password ? "border-red-500" : ""}
          disabled={loading}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password}</p>
        )}
      </div>

      {/* Privilege Level Field */}
      <div className="space-y-2">
        <Label htmlFor="edit-level" className="text-sm font-medium">
          Privilege Level <span className="text-red-500">*</span>
        </Label>
        <Select
          value={formData.level}
          onValueChange={(value) => setFormData(prev => ({ ...prev, level: value }))}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Level 1 (View Only)</SelectItem>
            <SelectItem value="2">Level 2 (Standard)</SelectItem>
            <SelectItem value="3">Level 3 (Administrator)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <DialogFooter className="flex justify-between sm:justify-between pt-4">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleteLoading || loading}
          className="mr-auto"
        >
          {deleteLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </>
          )}
        </Button>
        <div className="flex space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading || deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            type="button"
            onClick={handleSubmit}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={loading || deleteLoading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Update Admin
              </>
            )}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}