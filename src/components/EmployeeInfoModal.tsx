import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, User, Clock, Building, Signature, IdCard, Briefcase, Save, X, Calendar, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import DTRModal from "./DTRModal";
import { usePrivileges } from "@/hooks/usePrivileges";

interface EmployeeInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: number;
    employee_id: string;
    name: string;
    position: string;
    office: string;
    am_in: string;
    am_out: string;
    pm_in: string;
    pm_out: string;
    is_registered: boolean;
    is_noter: boolean;
    is_regular: boolean;
    signatory_same_as_name: boolean;
  } | null;
  onEmployeeUpdated?: () => void; // Make sure this line exists
}


// Generate time options in 24-hour format for consistency
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const hourStr = hour.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      times.push(`${hourStr}:${minuteStr}`);
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

// Helper function to convert 12-hour format to 24-hour format
const convertTo24Hour = (time12h: string) => {
  if (!time12h) return "08:00";
  
  // If already in 24-hour format, return as is
  if (time12h.match(/^\d{2}:\d{2}$/)) {
    return time12h;
  }
  
  // Convert from 12-hour format
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  if (hours === '12') {
    hours = '00';
  }
  
  if (modifier === 'PM') {
    hours = (parseInt(hours, 10) + 12).toString();
  }
  
  return `${hours.padStart(2, '0')}:${minutes}`;
};

// Helper function to convert 24-hour format to 12-hour format for display
const convertTo12Hour = (time24h: string) => {
  if (!time24h) return "08:00 AM";
  
  let [hours, minutes] = time24h.split(':');
  const hourNum = parseInt(hours, 10);
  const modifier = hourNum >= 12 ? 'PM' : 'AM';
  const displayHours = hourNum % 12 || 12;
  
  return `${displayHours}:${minutes} ${modifier}`;
};

export default function EmployeeInfoModal({ 
  isOpen, 
  onClose, 
  employee, 
  onEmployeeUpdated 
}: EmployeeInfoModalProps) {
  const [formData, setFormData] = useState({
    employee_id: "",
    name: "",
    position: "",
    office: "",
    am_in: "08:00",
    am_out: "12:00",
    pm_in: "13:00",
    pm_out: "17:00",
    is_registered: false,
    is_noter: false,
    is_regular: false,
    signatory_same_as_name: false
  });

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isDTRModalOpen, setIsDTRModalOpen] = useState(false);
  const { canUpdate, canDelete: canDeletePrivilege } = usePrivileges();

  // Initialize form data when employee changes
  useEffect(() => {
    if (employee) {
      setFormData({
        employee_id: employee.employee_id || "",
        name: employee.name || "",
        position: employee.position || "",
        office: employee.office || "",
        am_in: convertTo24Hour(employee.am_in) || "08:00",
        am_out: convertTo24Hour(employee.am_out) || "12:00",
        pm_in: convertTo24Hour(employee.pm_in) || "13:00",
        pm_out: convertTo24Hour(employee.pm_out) || "17:00",
        is_registered: employee.is_registered !== undefined ? employee.is_registered : true,
        is_noter: employee.is_noter !== undefined ? employee.is_noter : false,
        is_regular: employee.is_regular !== undefined ? employee.is_regular : true,
        signatory_same_as_name: employee.signatory_same_as_name !== undefined ? employee.signatory_same_as_name : true
      });
    }
  }, [employee]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!employee) return;
    
    try {
      setLoading(true);
      
      const updateData = {
        name: formData.name,
        position: formData.position,
        office: formData.office,
        registered: formData.is_registered ? 1 : 0,
        noter: formData.is_noter ? 1 : 0,
        regular: formData.is_regular ? 1 : 0,
        signatory: formData.signatory_same_as_name ? formData.name : formData.name,
        am_in: formData.am_in + ':00',
        am_out: formData.am_out + ':00',
        pm_in: formData.pm_in + ':00', 
        pm_out: formData.pm_out + ':00'
      };

      console.log('Updating employee:', employee.id, updateData);

      await api.updateEmployee(employee.id, updateData);
      toast.success('Employee information updated successfully');
      
      // Call the refresh callback if provided
      if (onEmployeeUpdated) {
        onEmployeeUpdated();
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to update employee:', error);
      toast.error('Failed to update employee information');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!employee) return;

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete employee "${employee.name}" (ID: ${employee.employee_id})? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      
      await api.deleteEmployee(employee.id);
      toast.success('Employee deleted successfully');
      
      // Call the refresh callback if provided
      if (onEmployeeUpdated) {
        onEmployeeUpdated();
      }
      
      onClose();
    } catch (error: any) {
      console.error('Failed to delete employee:', error);
      
      if (error.message.includes('foreign key constraint') || error.message.includes('DTR records')) {
        toast.error('Cannot delete employee', {
          description: 'This employee has DTR records. Please delete their DTR records first.'
        });
      } else {
        toast.error('Failed to delete employee');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancel = () => {
    if (employee) {
      setFormData({
        employee_id: employee.employee_id || "",
        name: employee.name || "",
        position: employee.position || "",
        office: employee.office || "",
        am_in: convertTo24Hour(employee.am_in) || "08:00",
        am_out: convertTo24Hour(employee.am_out) || "12:00",
        pm_in: convertTo24Hour(employee.pm_in) || "13:00",
        pm_out: convertTo24Hour(employee.pm_out) || "17:00",
        is_registered: employee.is_registered !== undefined ? employee.is_registered : true,
        is_noter: employee.is_noter !== undefined ? employee.is_noter : false,
        is_regular: employee.is_regular !== undefined ? employee.is_regular : true,
        signatory_same_as_name: employee.signatory_same_as_name !== undefined ? employee.signatory_same_as_name : true
      });
    }
    onClose();
  };

  if (!employee) return null;

    return (
      <>
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Edit Employee Information
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-1">
              {/* Basic Information */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="border-b border-border/50 pb-1">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Employee ID</label>
                      <Input
                        value={formData.employee_id}
                        onChange={(e) => handleInputChange('employee_id', e.target.value)}
                        className="w-full text-sm bg-muted"
                        disabled={true}
                      />
                    </div>

                    <div className="border-b border-border/50 pb-1">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Name</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full text-sm"
                        disabled={!canUpdate()}
                      />
                    </div>

                    <div className="pb-1">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                        <Signature className="h-3 w-3" />
                        Signatory
                      </label>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={formData.signatory_same_as_name}
                          onCheckedChange={(checked) => handleInputChange('signatory_same_as_name', checked as boolean)}
                        />
                        <span className="text-xs">Same as name</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="border-b border-border/50 pb-1">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Position</label>
                      <Input
                        value={formData.position}
                        onChange={(e) => handleInputChange('position', e.target.value)}
                        className="w-full text-sm"
                        list="position-list"
                        placeholder="Type or select position"
                      />
                      <datalist id="position-list">
                        <option value="Administrative Aide I" />
                        <option value="Administrative Aide II" />
                        <option value="Administrative Aide III" />
                        <option value="Administrative Assistant I" />
                        <option value="Administrative Assistant II" />
                        <option value="Administrative Officer I" />
                        <option value="Administrative Officer II" />
                        <option value="Administrative Officer III" />
                        <option value="Department Head" />
                        <option value="Job Order" />
                      </datalist>
                    </div>

                    <div className="border-b border-border/50 pb-1">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                        <Building className="h-3 w-3" />
                        Office
                      </label>
                      <Input
                        value={formData.office}
                        onChange={(e) => handleInputChange('office', e.target.value)}
                        className="w-full text-sm"
                        list="office-list"
                        placeholder="Type or select office"
                      />
                      <datalist id="office-list">
                        <option value="Mayor's Office" />
                        <option value="Vice Mayor's Office" />
                        <option value="Accounting Office" />
                        <option value="Budget Office" />
                        <option value="Treasurer's Office" />
                        <option value="Assessor's Office" />
                        <option value="Engineering Office" />
                        <option value="Health Office" />
                        <option value="Social Welfare Office" />
                      </datalist>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Work Schedule
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { key: 'am_in', label: 'AM In' },
                    { key: 'am_out', label: 'AM Out' },
                    { key: 'pm_in', label: 'PM In' },
                    { key: 'pm_out', label: 'PM Out' }
                  ].map(({ key, label }) => (
                    <div key={key} className="text-center bg-card rounded p-2 border border-border">
                      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                      <Select
                        value={formData[key as keyof typeof formData] as string}
                        onValueChange={(value) => handleInputChange(key, value)}
                      >
                        <SelectTrigger className="w-full text-center text-sm py-1">
                          <SelectValue placeholder="Select time">
                            {convertTo12Hour(formData[key as keyof typeof formData] as string)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          {timeOptions.map((time) => (
                            <SelectItem key={time} value={time} className="text-sm">
                              {convertTo12Hour(time)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Badges */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Employment Status
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={formData.is_registered}
                      onCheckedChange={(checked) => handleInputChange('is_registered', checked as boolean)}
                    />
                    <span className="text-sm">Registered</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={formData.is_noter}
                      onCheckedChange={(checked) => handleInputChange('is_noter', checked as boolean)}
                    />
                    <span className="text-sm">Noter</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={formData.is_regular}
                      onCheckedChange={(checked) => handleInputChange('is_regular', checked as boolean)}
                    />
                    <span className="text-sm">Regular</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-border pt-4 flex gap-2 justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex items-center gap-1 text-sm"
                    onClick={() => setIsDTRModalOpen(true)}
                  >
                    <Calendar className="h-3 w-3" />
                    View DTR
                  </Button>
                  {canDeletePrivilege() && (
                    <Button 
                      variant="destructive"
                      className="flex items-center gap-1 text-sm"
                      onClick={handleDelete}
                      disabled={deleteLoading || loading}
                    >
                      <Trash2 className="h-3 w-3" />
                      {deleteLoading ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
                
                {canUpdate() && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={handleCancel}
                      className="flex items-center gap-1 text-sm"
                      disabled={loading || deleteLoading}
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSave}
                      className="btn-success flex items-center gap-1 text-sm"
                      disabled={loading || deleteLoading}
                    >
                      <Save className="h-3 w-3" />
                      {loading ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      <DTRModal
        isOpen={isDTRModalOpen}
        onClose={() => setIsDTRModalOpen(false)}
        employee={employee as any}
      />
    </>
  );
}