// DeptHeads.tsx
import { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext'; // ADD PRIVILEGE CHECK
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface DeptHeadFormData {
  name: string;
  position: string;
  office: string;
  signatory: string;
  signatorySameAsName: boolean;
}

interface DeptHead {
  noter_id: number;  // Changed from 'id' to 'noter_id'
  name: string;
  position: string;
  office: string;
  signatory: string;
  source: string;
}

function AddDeptHeadModal({ 
  isOpen, 
  onClose, 
  onSubmit,
  positions,
  offices,
  deptHead,
  mode = "add"
}: { 
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => void;
  positions: string[];
  offices: string[];
  deptHead?: DeptHead;
  mode?: "add" | "edit";
}) {
  const { canCreate, canUpdate, canDelete } = useAuth(); // ADD PRIVILEGE CHECK
  
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<DeptHeadFormData>({
    name: '',
    position: '',
    office: '',
    signatory: '',
    signatorySameAsName: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && deptHead) {
        console.log("Editing department head:", deptHead);
        // Pre-populate form with department head data
        setFormData({
          name: deptHead.name || '',
          position: deptHead.position || '',
          office: deptHead.office || '',
          signatory: deptHead.signatory || '',
          signatorySameAsName: deptHead.name === deptHead.signatory
        });
      } else {
        // Reset form for add mode
        setFormData({
          name: '',
          position: '',
          office: '',
          signatory: '',
          signatorySameAsName: true
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, deptHead]);

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
    if (!formData.signatorySameAsName && !formData.signatory.trim()) {
      newErrors.signatory = "Signatory is required";
    }

    // Position validation
    if (!formData.position) {
      newErrors.position = "Position is required";
    }

    // Office validation
    if (!formData.office) {
      newErrors.office = "Office is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (mode === "add" && !canCreate()) {
      toast.info("You don't have permission to add department heads");
      return;
    }
    
    if (mode === "edit" && !canUpdate()) {
      toast.info("You don't have permission to edit department heads");
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Determine signatory value
      const signatoryValue = formData.signatorySameAsName ? formData.name : formData.signatory;

      await onSubmit({
        name: formData.name.trim(),
        position: formData.position,
        office: formData.office,
        signatorySameAsName: formData.signatorySameAsName,
        signatory: signatoryValue.trim()
      });
      
      // Reset form after successful submission in add mode
      if (mode === "add") {
        setFormData({
          name: '',
          position: '',
          office: '',
          signatory: '',
          signatorySameAsName: true
        });
      }
    } catch (error) {
      // Error handling is done in the parent component
      console.error(`Error ${mode === "add" ? "adding" : "updating"} department head:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canDelete()) {
      toast.info("You don't have permission to delete department heads");
      return;
    }

    if (!deptHead) return;

    if (!confirm("Are you sure you want to delete this department head?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Call the delete API using noter_id
      await api.deleteNoter(deptHead.noter_id);
      
      toast.success("Department Head deleted successfully");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete department head");
      console.error("Error deleting department head:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSignatorySameAsNameChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      signatorySameAsName: checked,
      signatory: checked ? prev.name : prev.signatory
    }));
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      signatory: prev.signatorySameAsName ? value : prev.signatory
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {mode === "add" ? "Add New Department Head" : "Edit Department Head"}
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
              id="signatorySameAsName"
              checked={formData.signatorySameAsName}
              onCheckedChange={handleSignatorySameAsNameChange}
              disabled={loading}
            />
            <Label htmlFor="signatorySameAsName" className="text-sm font-medium cursor-pointer">
              Same as Name
            </Label>
          </div>

          {/* Signatory Field */}
          {!formData.signatorySameAsName && (
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

          {/* Office Field */}
          <div className="space-y-2">
            <Label htmlFor="office" className="text-sm font-medium">
              Office <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.office} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, office: value }))}
              disabled={loading}
            >
              <SelectTrigger className={errors.office ? "border-red-500" : ""}>
                <SelectValue placeholder="Select office" />
              </SelectTrigger>
              <SelectContent>
                {offices.map((office) => (
                  <SelectItem key={office} value={office}>
                    {office}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.office && (
              <p className="text-sm text-red-500">{errors.office}</p>
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
                onClick={onClose}
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
                      {mode === "add" ? "Add Dept. Head" : "Update Dept. Head"}
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

export default function DeptHeads() {
  const { canCreate, canUpdate, canDelete } = useAuth(); // ADD PRIVILEGE CHECK
  
  const [searchTerm, setSearchTerm] = useState("");
  const [noters, setNoters] = useState<DeptHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [positions, setPositions] = useState<string[]>([]);
  const [offices, setOffices] = useState<string[]>([]);
  const [selectedDeptHead, setSelectedDeptHead] = useState<DeptHead | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    fetchNoters();
  }, []);

  const fetchNoters = async () => {
    setLoading(true);
    try {
      const data = await api.noters();
      console.log("Fetched noters data:", data); // Debug log
      setNoters(data);
      
      // Extract unique positions and offices from the noters data
      const uniquePositions = Array.from(new Set(data
        .map((noter: DeptHead) => noter.position)
        .filter(Boolean)
      )).sort();

      const uniqueOffices = Array.from(new Set(data
        .map((noter: DeptHead) => noter.office)
        .filter(Boolean)
      )).sort();

      setPositions(uniquePositions);
      setOffices(uniqueOffices);
    } catch (error) {
      toast.error("Failed to load department heads");
    } finally {
      setLoading(false);
    }
  };

  const handleRowDoubleClick = (noter: DeptHead) => {
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canUpdate()) {
      toast.info("You don't have permission to edit department head information");
      return;
    }

    // Print the ID and other details to console
    console.log("🟢 Double-clicked Department Head:", noter);
    console.log("   Noter ID:", noter.noter_id);
    console.log("   Type of Noter ID:", typeof noter.noter_id);
    console.log("   Name:", noter.name);
    console.log("   Position:", noter.position);
    console.log("   Office:", noter.office);
    
    setSelectedDeptHead(noter);
    setEditModalOpen(true);
  };

  const handleAddDeptHead = async (formData: any) => {
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canCreate()) {
      toast.info("You don't have permission to add department heads");
      return;
    }

    try {
      // Call the actual API endpoint
      await api.addNoter({
        name: formData.name,
        position: formData.position,
        office: formData.office,
        signatory: formData.signatory
      });
      
      // Refresh the noters list to get the updated data
      await fetchNoters();
      
      toast.success("Department Head added successfully");
      setIsAddModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add department head");
      console.error("Error adding department head:", error);
      throw error;
    }
  };

  const handleEditDeptHead = async (formData: any) => {
    // ADD PRIVILEGE CHECK: Prevent unauthorized access
    if (!canUpdate()) {
      toast.info("You don't have permission to edit department heads");
      return;
    }

    try {
      if (!selectedDeptHead) {
        console.error("No department head selected for update");
        return;
      }

      console.log("🔄 Updating department head:", {
        id: selectedDeptHead.noter_id,  // Use noter_id instead of id
        name: formData.name,
        position: formData.position,
        office: formData.office,
        signatory: formData.signatory
      });

      // Validate that we have a valid ID
      if (!selectedDeptHead.noter_id || isNaN(selectedDeptHead.noter_id)) {
        console.error("Invalid department head ID:", selectedDeptHead.noter_id);
        toast.error("Invalid department head ID");
        return;
      }

      // Call the update API using noter_id
      await api.updateNoter(selectedDeptHead.noter_id, {
        name: formData.name,
        position: formData.position,
        office: formData.office,
        signatory: formData.signatory
      });
      
      // Refresh the noters list
      await fetchNoters();
      
      toast.success("Department Head updated successfully");
      setEditModalOpen(false);
      setSelectedDeptHead(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update department head");
      console.error("Error updating department head:", error);
      throw error;
    }
  };

  const filteredData = noters.filter((noter: DeptHead) =>
    noter.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    noter.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    noter.office?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: "noter_id", label: "Noter ID" },
    { key: "name", label: "Name" },
    { key: "position", label: "Position" },
    { key: "office", label: "Office" },
    { key: "signatory", label: "Signatory" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Department Heads"
        searchPlaceholder="Search department heads..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        actions={
          // ADD PRIVILEGE CHECK: Only show add button if user can create
          canCreate() ? (
            <Button 
              className="btn-gradient hover:shadow-lg transform hover:scale-105 transition-all duration-300"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Dept. Head
            </Button>
          ) : null
        }
      />

      <div className="p-6">
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          renderRow={(noter: DeptHead, index: number) => (
            <tr
              key={index}  // <-- USE INDEX INSTEAD
              className="border-b border-border hover:bg-accent/50 transition-all duration-300 cursor-pointer group"
              onDoubleClick={() => handleRowDoubleClick(noter)}
            >
              <td className="px-6 py-4 text-sm text-card-foreground group-hover:text-primary transition-colors">{noter.noter_id || "—"}</td>
              <td className="px-6 py-4 text-sm font-medium text-card-foreground group-hover:text-primary transition-colors">{noter.name || "—"}</td>
              <td className="px-6 py-4 text-sm text-muted-foreground group-hover:text-card-foreground transition-colors">{noter.position || "—"}</td>
              <td className="px-6 py-4 text-sm text-muted-foreground group-hover:text-card-foreground transition-colors">{noter.office || "—"}</td>
              <td className="px-6 py-4 text-sm text-card-foreground group-hover:text-primary transition-colors">{noter.signatory || "—"}</td>
            </tr>
          )}
        />
      </div>

      {/* Add Modal */}
      <AddDeptHeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddDeptHead}
        positions={positions}
        offices={offices}
        mode="add"
      />

      {/* Edit Modal */}
      <AddDeptHeadModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedDeptHead(null);
        }}
        onSubmit={handleEditDeptHead}
        positions={positions}
        offices={offices}
        deptHead={selectedDeptHead || undefined}
        mode="edit"
      />
    </div>
  );
}