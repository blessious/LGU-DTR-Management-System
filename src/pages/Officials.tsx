import { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext'; // ADD PRIVILEGE CHECK
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface OfficialFormData {
  name: string;
  position: string;
  signatory: string;
  sameAsName: boolean;
}

interface Official {
  id: number;
  name: string;
  position: string;
  signatory: string;
  official_no?: number;
}

function OfficialModal({ 
  onOfficialUpdated, 
  official,
  mode = "add"
}: { 
  onOfficialUpdated: () => void;
  official?: Official;
  mode?: "add" | "edit";
}) {
  const { canCreate, canUpdate, canDelete } = useAuth(); // ADD PRIVILEGE CHECK
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<OfficialFormData>({
    name: '',
    position: '',
    signatory: '',
    sameAsName: true
  });
  const [positions, setPositions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchPositions = async () => {
    try {
      const data = await api.getOfficialPositions();
      setPositions(data);
    } catch (error) {
      toast.error("Failed to load positions");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchPositions();
      if (mode === "edit" && official) {
        // Pre-populate form with official data
        setFormData({
          name: official.name || '',
          position: official.position || '',
          signatory: official.signatory || '',
          sameAsName: official.name === official.signatory
        });
      } else {
        // Reset form for add mode
        setFormData({
          name: '',
          position: '',
          signatory: '',
          sameAsName: true
        });
      }
      setErrors({});
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (!/^[A-Za-z\s.]+$/.test(formData.name)) {
      newErrors.name = "Name can only contain letters, spaces, and periods";
    }

    // Signatory validation
    if (!formData.sameAsName && !formData.signatory.trim()) {
      newErrors.signatory = "Signatory is required";
    }

    // Position validation
    if (!formData.position) {
      newErrors.position = "Position is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (mode === "add" && !canCreate()) {
      toast.info("You don't have permission to add officials");
      return;
    }
    
    if (mode === "edit" && !canUpdate()) {
      toast.info("You don't have permission to edit officials");
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Determine signatory value
      const signatoryValue = formData.sameAsName ? formData.name : formData.signatory;

      if (mode === "add") {
        // Call the API to add official
        await api.addOfficial({
          name: formData.name.trim(),
          position: formData.position,
          signatory: signatoryValue.trim()
        });
        toast.success("Official added successfully");
      } else if (mode === "edit" && official) {
        // Call the API to update official
        await api.updateOfficial(official.id, {
          name: formData.name.trim(),
          position: formData.position,
          signatory: signatoryValue.trim()
        });
        toast.success("Official updated successfully");
      }
      
      // Refresh the officials list
      onOfficialUpdated();
      
      // Close modal
      setOpen(false);
      
      // Reset form
      if (mode === "add") {
        setFormData({
          name: '',
          position: '',
          signatory: '',
          sameAsName: true
        });
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode === "add" ? "add" : "update"} official`);
      console.error(`Error ${mode === "add" ? "adding" : "updating"} official:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canDelete()) {
      toast.info("You don't have permission to delete officials");
      return;
    }

    if (!official) return;

    setDeleteLoading(true);
    try {
      await api.deleteOfficial(official.id);
      toast.success("Official deleted successfully");
      onOfficialUpdated();
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete official");
      console.error("Error deleting official:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSameAsNameChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sameAsName: checked,
      signatory: checked ? prev.name : prev.signatory
    }));
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      signatory: prev.sameAsName ? value : prev.signatory
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          // ADD PRIVILEGE CHECK: Only show add button if user can create
          canCreate() ? (
            <Button className="btn-gradient hover:shadow-lg transform hover:scale-105 transition-all duration-300">
              <Plus className="mr-2 h-4 w-4" />
              Add Official
            </Button>
          ) : null
        ) : (
          <div className="hidden"></div> // Invisible trigger for edit mode
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {mode === "add" ? "Add New Official" : "Edit Official"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter full name"
              className={errors.name ? "border-red-500" : ""}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Same as Name Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sameAsName"
              checked={formData.sameAsName}
              onCheckedChange={handleSameAsNameChange}
              disabled={loading}
            />
            <Label htmlFor="sameAsName" className="text-sm font-medium cursor-pointer">
              Same as Name
            </Label>
          </div>

          {/* Signatory Field */}
          {!formData.sameAsName && (
            <div className="space-y-2">
              <Label htmlFor="signatory" className="text-sm font-medium">
                Signatory <span className="text-red-500">*</span>
              </Label>
              <Input
                id="signatory"
                value={formData.signatory}
                onChange={(e) => setFormData(prev => ({ ...prev, signatory: e.target.value }))}
                placeholder="Enter signatory name"
                className={errors.signatory ? "border-red-500" : ""}
                disabled={loading}
              />
              {errors.signatory && (
                <p className="text-sm text-red-500">{errors.signatory}</p>
              )}
            </div>
          )}

          {/* Position Field */}
          <div className="space-y-2">
            <Label htmlFor="position" className="text-sm font-medium">
              Position <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.position} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, position: value }))}
              disabled={loading}
            >
              <SelectTrigger className={errors.position ? "border-red-500" : ""}>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.position && (
              <p className="text-sm text-red-500">{errors.position}</p>
            )}
          </div>

          {/* Action Buttons */}
          <DialogFooter className="flex justify-between sm:justify-between pt-4">
            {mode === "edit" && (
              // ADD PRIVILEGE CHECK: Only show delete button if user can delete
              canDelete() && (
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
              >
                Cancel
              </Button>
              {/* ADD PRIVILEGE CHECK: Only show submit button if user has appropriate permissions */}
              {(mode === "add" && canCreate()) || (mode === "edit" && canUpdate()) ? (
                <Button 
                  type="submit" 
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
                      {mode === "add" ? "Add Official" : "Update Official"}
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Officials() {
  const { canUpdate } = useAuth(); // ADD PRIVILEGE CHECK
  
  const [searchTerm, setSearchTerm] = useState("");
  const [officials, setOfficials] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOfficial, setSelectedOfficial] = useState<Official | null>(null);

  useEffect(() => {
    fetchOfficials();
  }, []);

  const fetchOfficials = async () => {
    setLoading(true);
    try {
      const data = await api.officials();
      setOfficials(data);
    } catch (error) {
      toast.error("Failed to load officials");
    } finally {
      setLoading(false);
    }
  };

  const handleRowDoubleClick = (official: Official) => {
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canUpdate()) {
      toast.info("You don't have permission to edit official information");
      return;
    }

    setSelectedOfficial(official);
    setEditModalOpen(true);
  };

  const filteredData = officials.filter((official: Official) =>
    official.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    official.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: "no", label: "No." },
    { key: "name", label: "Name" },
    { key: "position", label: "Position" },
    { key: "signatory", label: "Signatory" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Officials"
        searchPlaceholder="Search officials..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        actions={
          <OfficialModal 
            onOfficialUpdated={fetchOfficials} 
            mode="add"
          />
        }
      />

      <div className="p-6">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          renderRow={(official: Official, index: number) => (
            <tr
              key={official.id}
              className="border-b border-border hover:bg-accent/50 transition-all duration-300 cursor-pointer group"
              onDoubleClick={() => handleRowDoubleClick(official)}
            >
              <td className="px-6 py-4 text-sm text-card-foreground group-hover:text-primary transition-colors">{official.official_no || index + 1}</td>
              <td className="px-6 py-4 text-sm font-medium text-card-foreground group-hover:text-primary transition-colors">{official.name || "—"}</td>
              <td className="px-6 py-4 text-sm text-muted-foreground group-hover:text-card-foreground transition-colors">{official.position || "—"}</td>
              <td className="px-6 py-4 text-sm text-card-foreground group-hover:text-primary transition-colors">{official.signatory || "—"}</td>
            </tr>
          )}
        />
      </div>

      {/* Edit Modal (controlled separately) */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Official</DialogTitle>
          </DialogHeader>
          {selectedOfficial && (
            <EditOfficialForm
              official={selectedOfficial}
              onOfficialUpdated={() => {
                fetchOfficials();
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

// Separate form component for edit mode to handle state properly
function EditOfficialForm({ 
  official, 
  onOfficialUpdated, 
  onCancel 
}: { 
  official: Official;
  onOfficialUpdated: () => void;
  onCancel: () => void;
}) {
  const { canUpdate, canDelete } = useAuth(); // ADD PRIVILEGE CHECK
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<OfficialFormData>({
    name: official.name || '',
    position: official.position || '',
    signatory: official.signatory || '',
    sameAsName: official.name === official.signatory
  });
  const [positions, setPositions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      const data = await api.getOfficialPositions();
      setPositions(data);
    } catch (error) {
      toast.error("Failed to load positions");
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (!/^[A-Za-z\s.]+$/.test(formData.name)) {
      newErrors.name = "Name can only contain letters, spaces, and periods";
    }

    // Signatory validation
    if (!formData.sameAsName && !formData.signatory.trim()) {
      newErrors.signatory = "Signatory is required";
    }

    // Position validation
    if (!formData.position) {
      newErrors.position = "Position is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canUpdate()) {
      toast.info("You don't have permission to edit officials");
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Determine signatory value
      const signatoryValue = formData.sameAsName ? formData.name : formData.signatory;

      // Call the API to update official
      await api.updateOfficial(official.id, {
        name: formData.name.trim(),
        position: formData.position,
        signatory: signatoryValue.trim()
      });
      
      toast.success("Official updated successfully");
      onOfficialUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to update official");
      console.error("Error updating official:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canDelete()) {
      toast.info("You don't have permission to delete officials");
      return;
    }

    if (!confirm("Are you sure you want to delete this official?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      await api.deleteOfficial(official.id);
      toast.success("Official deleted successfully");
      onOfficialUpdated();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete official");
      console.error("Error deleting official:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSameAsNameChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sameAsName: checked,
      signatory: checked ? prev.name : prev.signatory
    }));
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      signatory: prev.sameAsName ? value : prev.signatory
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="edit-name" className="text-sm font-medium">
          Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Enter full name"
          className={errors.name ? "border-red-500" : ""}
          disabled={loading}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* Same as Name Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="edit-sameAsName"
          checked={formData.sameAsName}
          onCheckedChange={handleSameAsNameChange}
          disabled={loading}
        />
        <Label htmlFor="edit-sameAsName" className="text-sm font-medium cursor-pointer">
          Same as Name
        </Label>
      </div>

      {/* Signatory Field */}
      {!formData.sameAsName && (
        <div className="space-y-2">
          <Label htmlFor="edit-signatory" className="text-sm font-medium">
            Signatory <span className="text-red-500">*</span>
          </Label>
          <Input
            id="edit-signatory"
            value={formData.signatory}
            onChange={(e) => setFormData(prev => ({ ...prev, signatory: e.target.value }))}
            placeholder="Enter signatory name"
            className={errors.signatory ? "border-red-500" : ""}
            disabled={loading}
          />
          {errors.signatory && (
            <p className="text-sm text-red-500">{errors.signatory}</p>
          )}
        </div>
      )}

      {/* Position Field */}
      <div className="space-y-2">
        <Label htmlFor="edit-position" className="text-sm font-medium">
          Position <span className="text-red-500">*</span>
        </Label>
        <Select 
          value={formData.position} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, position: value }))}
          disabled={loading}
        >
          <SelectTrigger className={errors.position ? "border-red-500" : ""}>
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            {positions.map((position) => (
              <SelectItem key={position} value={position}>
                {position}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.position && (
          <p className="text-sm text-red-500">{errors.position}</p>
        )}
      </div>

      {/* Action Buttons */}
      <DialogFooter className="flex justify-between sm:justify-between pt-4">
        {/* ADD PRIVILEGE CHECK: Only show delete button if user can delete */}
        {canDelete() && (
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
          >
            Cancel
          </Button>
          {/* ADD PRIVILEGE CHECK: Only show update button if user can update */}
          {canUpdate() && (
            <Button 
              type="submit" 
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
                  Update Official
                </>
              )}
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  );
}