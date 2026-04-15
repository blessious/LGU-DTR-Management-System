import { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save, Loader2, CheckCircle, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DialogTrigger } from "@radix-ui/react-dialog";

interface BiometricFormData {
  name: string;
  ip_address: string;
  port: string;
  active: boolean;
}

interface BiometricDevice {
  biometric_id: number;
  name: string;
  ip_address: string;
  port: string;
  active: boolean;
}

interface BiometricDeviceStatus extends BiometricDevice {
  online?: boolean;
  lastChecked?: string;
  userCount?: number;
  attendanceCount?: number;
  firmware?: string;
}

function BiometricModal({ 
  onBiometricUpdated, 
  device,
  mode = "add"
}: { 
  onBiometricUpdated: () => void;
  device?: BiometricDevice;
  mode?: "add" | "edit";
}) {
  const { canManageBiometrics } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<BiometricFormData>({
    name: '',
    ip_address: '',
    port: '',
    active: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      if (mode === "edit" && device) {
        setFormData({
          name: device.name || '',
          ip_address: device.ip_address || '',
          port: device.port?.toString() || '',
          active: device.active || true
        });
      } else {
        setFormData({
          name: '',
          ip_address: '',
          port: '',
          active: true
        });
      }
      setErrors({});
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Device name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Device name must be at least 2 characters";
    }

    if (!formData.ip_address.trim()) {
      newErrors.ip_address = "IP address is required";
    } else {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(formData.ip_address)) {
        newErrors.ip_address = "Please enter a valid IP address";
      }
    }

    if (!formData.port.trim()) {
      newErrors.port = "Port is required";
    } else {
      const portNum = parseInt(formData.port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        newErrors.port = "Port must be a number between 1 and 65535";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canManageBiometrics()) {
      toast.info("You don't have permission to manage biometric devices");
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const biometricData = {
        name: formData.name.trim(),
        ip_address: formData.ip_address.trim(),
        port: parseInt(formData.port),
        active: formData.active
      };

      if (mode === "add") {
        await api.addBiometric(biometricData);
        toast.success("Biometric device added successfully");
      } else if (mode === "edit" && device) {
        await api.updateBiometric(device.biometric_id, biometricData);
        toast.success("Biometric device updated successfully");
      }
      
      onBiometricUpdated();
      setOpen(false);
      
      if (mode === "add") {
        setFormData({
          name: '',
          ip_address: '',
          port: '',
          active: true
        });
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode === "add" ? "add" : "update"} biometric device`);
      console.error(`Error ${mode === "add" ? "adding" : "updating"} biometric device:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canManageBiometrics()) {
      toast.info("You don't have permission to delete biometric devices");
      return;
    }

    if (!device) return;

    if (!confirm("Are you sure you want to delete this biometric device?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      await api.deleteBiometric(device.biometric_id);
      toast.success("Biometric device deleted successfully");
      onBiometricUpdated();
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete biometric device");
      console.error("Error deleting biometric device:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          canManageBiometrics() ? (
            <Button className="btn-gradient hover:shadow-lg transform hover:scale-105 transition-all duration-300">
              <Plus className="mr-2 h-4 w-4" />
              Add Biometric
            </Button>
          ) : null
        ) : (
          <div className="hidden"></div>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold dark:text-white">
            {mode === "add" ? "Add New Biometric Device" : "Edit Biometric Device"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium dark:text-gray-300">
              Device Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter device name"
              className={errors.name ? "border-red-500 dark:border-red-500" : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip_address" className="text-sm font-medium dark:text-gray-300">
              IP Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ip_address"
              value={formData.ip_address}
              onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
              placeholder="Enter IP address (e.g., 192.168.1.100)"
              className={errors.ip_address ? "border-red-500 dark:border-red-500" : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"}
              disabled={loading}
            />
            {errors.ip_address && (
              <p className="text-sm text-red-500">{errors.ip_address}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="port" className="text-sm font-medium dark:text-gray-300">
              Port <span className="text-red-500">*</span>
            </Label>
            <Input
              id="port"
              type="number"
              value={formData.port}
              onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
              placeholder="Enter port number"
              className={errors.port ? "border-red-500 dark:border-red-500" : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"}
              disabled={loading}
              min="1"
              max="65535"
            />
            {errors.port && (
              <p className="text-sm text-red-500">{errors.port}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, active: checked as boolean }))
              }
              disabled={loading}
              className="dark:border-gray-600 data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
            />
            <Label htmlFor="active" className="text-sm font-medium cursor-pointer dark:text-gray-300">
              Active Device
            </Label>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between pt-4">
            {mode === "edit" && (
              canManageBiometrics() && (
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
              )
            )}
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading || deleteLoading}
                className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              {canManageBiometrics() && (
                <Button 
                  type="submit" 
                  className="bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-700 dark:hover:bg-teal-800"
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
                      {mode === "add" ? "Add Device" : "Update Device"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Biometrics() {
  const { canManageBiometrics } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [devices, setDevices] = useState<BiometricDeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BiometricDevice | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await api.biometrics();
      setDevices(data);
    } catch (error) {
      toast.error("Failed to load biometric devices");
    } finally {
      setLoading(false);
    }
  };

  const checkAllDevicesStatus = async () => {
    setCheckingStatus(true);
    try {
      const updatedDevices = await Promise.all(
        devices.map(async (device) => {
          if (!device.active) {
            return { 
              ...device, 
              online: false, 
              lastChecked: new Date().toISOString(),
              userCount: 0,
              attendanceCount: 0 
            };
          }
          
          try {
            const status = await api.checkBiometricStatus({
              ip_address: device.ip_address,
              port: parseInt(device.port)
            });
            
            return {
              ...device,
              online: status.online,
              userCount: status.userCount,
              attendanceCount: status.attendanceCount,
              firmware: status.firmware,
              lastChecked: new Date().toISOString()
            };
          } catch (error) {
            console.error(`Error checking status for device ${device.biometric_id}:`, error);
            return {
              ...device,
              online: false,
              lastChecked: new Date().toISOString(),
              userCount: 0,
              attendanceCount: 0
            };
          }
        })
      );
      
      setDevices(updatedDevices);
      
      const onlineCount = updatedDevices.filter(device => device.online).length;
      const activeCount = updatedDevices.filter(device => device.active).length;
      
      toast.success(`Checked ${activeCount} active devices - ${onlineCount} online`);
    } catch (error) {
      toast.error("Failed to check device status");
      console.error("Error checking device status:", error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRowDoubleClick = (device: BiometricDevice) => {
    if (!canManageBiometrics()) {
      toast.info("You don't have permission to edit biometric devices");
      return;
    }
    setSelectedDevice(device);
    setEditModalOpen(true);
  };

  const filteredData = devices.filter((device: BiometricDeviceStatus) =>
    device.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.ip_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: "biometric_id", label: "Biometric ID" },
    { key: "name", label: "Name" },
    { key: "ip_address", label: "IP Address" },
    { key: "port", label: "Port" },
    { key: "active", label: "Active" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Biometrics"
        searchPlaceholder="Search biometric devices..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        actions={
          <div className="flex gap-2">
            <Button 
              onClick={checkAllDevicesStatus}
              disabled={checkingStatus || devices.length === 0}
              variant="outline"
              className="border-blue-500 text-blue-500 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              {checkingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Check All Active Devices
                </>
              )}
            </Button>
            <BiometricModal 
              onBiometricUpdated={fetchDevices} 
              mode="add"
            />
          </div>
        }
      />

      <div className="p-6">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          renderRow={(device: BiometricDeviceStatus, index: number) => (
            <tr
              key={device.biometric_id}
              className="border-b border-border dark:border-gray-700 hover:bg-accent/50 dark:hover:bg-gray-800/50 transition-all duration-300 cursor-pointer group"
              onDoubleClick={() => handleRowDoubleClick(device)}
            >
              <td className="px-6 py-4 text-sm text-card-foreground dark:text-white group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">
                {device.biometric_id || "—"}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-card-foreground dark:text-white group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">
                {device.name || "—"}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground dark:text-gray-400 group-hover:text-card-foreground dark:group-hover:text-gray-300 transition-colors">
                {device.ip_address || "—"}
              </td>
              <td className="px-6 py-4 text-sm text-card-foreground dark:text-white group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">
                {device.port || "—"}
              </td>
              <td className="px-6 py-4 text-sm">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  device.active 
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  {device.active ? "Yes" : "No"}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <div className="flex gap-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                    device.online === undefined 
                      ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400" 
                      : device.online 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}>
                    {device.online === undefined ? (
                      <>Not Checked</>
                    ) : device.online ? (
                      <>
                        <Wifi className="h-3 w-3" />
                        Online
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3" />
                        Offline
                      </>
                    )}
                  </span>
                </div>
              </td>
            </tr>
          )}
        />
      </div>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold dark:text-white">Edit Biometric Device</DialogTitle>
          </DialogHeader>
          {selectedDevice && (
            <EditBiometricForm
              device={selectedDevice}
              onBiometricUpdated={() => {
                fetchDevices();
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

function EditBiometricForm({ 
  device, 
  onBiometricUpdated, 
  onCancel 
}: { 
  device: BiometricDevice;
  onBiometricUpdated: () => void;
  onCancel: () => void;
}) {
  const { canManageBiometrics } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<BiometricFormData>({
    name: device.name || '',
    ip_address: device.ip_address || '',
    port: device.port?.toString() || '',
    active: device.active || true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Device name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Device name must be at least 2 characters";
    }

    if (!formData.ip_address.trim()) {
      newErrors.ip_address = "IP address is required";
    } else {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(formData.ip_address)) {
        newErrors.ip_address = "Please enter a valid IP address";
      }
    }

    if (!formData.port.trim()) {
      newErrors.port = "Port is required";
    } else {
      const portNum = parseInt(formData.port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        newErrors.port = "Port must be a number between 1 and 65535";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canManageBiometrics()) {
      toast.info("You don't have permission to edit biometric devices");
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const biometricData = {
        name: formData.name.trim(),
        ip_address: formData.ip_address.trim(),
        port: parseInt(formData.port),
        active: formData.active
      };

      await api.updateBiometric(device.biometric_id, biometricData);
      
      toast.success("Biometric device updated successfully");
      onBiometricUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update biometric device");
      console.error("Error updating biometric device:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canManageBiometrics()) {
      toast.info("You don't have permission to delete biometric devices");
      return;
    }

    if (!confirm("Are you sure you want to delete this biometric device?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      await api.deleteBiometric(device.biometric_id);
      toast.success("Biometric device deleted successfully");
      onBiometricUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete biometric device");
      console.error("Error deleting biometric device:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name" className="text-sm font-medium dark:text-gray-300">
          Device Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter device name"
          className={errors.name ? "border-red-500 dark:border-red-500" : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"}
          disabled={loading}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-ip_address" className="text-sm font-medium dark:text-gray-300">
          IP Address <span className="text-red-500">*</span>
        </Label>
        <Input
          id="edit-ip_address"
          value={formData.ip_address}
          onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
          placeholder="Enter IP address (e.g., 192.168.1.100)"
          className={errors.ip_address ? "border-red-500 dark:border-red-500" : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"}
          disabled={loading}
        />
        {errors.ip_address && (
          <p className="text-sm text-red-500">{errors.ip_address}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-port" className="text-sm font-medium dark:text-gray-300">
          Port <span className="text-red-500">*</span>
        </Label>
        <Input
          id="edit-port"
          type="number"
          value={formData.port}
          onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
          placeholder="Enter port number"
          className={errors.port ? "border-red-500 dark:border-red-500" : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"}
          disabled={loading}
          min="1"
          max="65535"
        />
        {errors.port && (
          <p className="text-sm text-red-500">{errors.port}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="edit-active"
          checked={formData.active}
          onCheckedChange={(checked) => 
            setFormData(prev => ({ ...prev, active: checked as boolean }))
          }
          disabled={loading}
          className="dark:border-gray-600 data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500"
        />
        <Label htmlFor="edit-active" className="text-sm font-medium cursor-pointer dark:text-gray-300">
          Active Device
        </Label>
      </div>

      <DialogFooter className="flex justify-between sm:justify-between pt-4">
        {canManageBiometrics() && (
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
            onClick={onCancel}
            disabled={loading || deleteLoading}
            className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </Button>
          {canManageBiometrics() && (
            <Button 
              type="submit" 
              className="bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-700 dark:hover:bg-teal-800"
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
                  Update Device
                </>
              )}
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  );
}