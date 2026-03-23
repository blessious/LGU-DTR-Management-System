import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, User, Clock, Building, Signature, IdCard, Briefcase, Save, X, Calendar, Trash2, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const [overrides, setOverrides] = useState<any[]>([]);
  const [groupedOverrides, setGroupedOverrides] = useState<any[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);

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
      fetchOverrides(employee.id);
    }
  }, [employee]);

  const fetchOverrides = async (id: number) => {
    try {
      setLoadingOverrides(true);
      const [allData, groupedData] = await Promise.all([
        api.getScheduleOverrides(id),
        api.getGroupedScheduleOverrides(id)
      ]);
      setOverrides(allData);
      setGroupedOverrides(groupedData);
    } catch (error) {
      console.error('Failed to fetch overrides:', error);
    } finally {
      setLoadingOverrides(false);
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    
    const sStr = s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const eStr = e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    
    if (start === end) return eStr;
    return `${sStr} to ${eStr}`;
  };

  const handleDeleteOverride = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this schedule override?")) return;
    try {
      await api.deleteScheduleOverride(id);
      toast.success("Schedule override deleted");
      if (employee) fetchOverrides(employee.id);
    } catch (error) {
      toast.error("Failed to delete override");
    }
  };

  const getTodayOverride = () => {
    const today = new Date().toISOString().split('T')[0];
    return overrides.find(o => {
        const oDate = new Date(o.date).toISOString().split('T')[0];
        return oDate === today;
    });
  };

  const todayOverride = getTodayOverride();

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
            
            <Tabs defaultValue="info" className="w-full">
              <div className="flex justify-center border-b border-border/50 bg-muted/20 pb-0 shadow-sm">
                <TabsList className="bg-transparent h-10 gap-4">
                  <TabsTrigger value="info" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground">
                    <IdCard className="h-3.5 w-3.5 mr-2" /> Basic Info
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground">
                    <Clock className="h-3.5 w-3.5 mr-2" /> Schedule
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="py-4 px-1 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                <TabsContent value="info" className="mt-0 space-y-4">
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-muted-foreground uppercase tracking-tight">
                      <IdCard className="h-4 w-4" /> Personal Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Employee ID</label>
                          <Input value={formData.employee_id} className="h-9 text-sm bg-muted/50 font-mono" disabled />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Full Name</label>
                          <Input value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="h-9 text-sm" disabled={!canUpdate()} />
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-border/10">
                          <Checkbox id="sig-check" checked={formData.signatory_same_as_name} onCheckedChange={(checked) => handleInputChange('signatory_same_as_name', checked as boolean)} />
                          <label htmlFor="sig-check" className="text-xs font-medium cursor-pointer">Signatory same as name</label>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Position</label>
                          <Input value={formData.position} onChange={(e) => handleInputChange('position', e.target.value)} className="h-9 text-sm" list="position-list" />
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
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Office / Department</label>
                          <Input value={formData.office} onChange={(e) => handleInputChange('office', e.target.value)} className="h-9 text-sm" list="office-list" />
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

                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-muted-foreground uppercase tracking-tight">
                      <Briefcase className="h-4 w-4" /> Employment Status
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {[
                        { id: 'is_registered', label: 'Registered' },
                        { id: 'is_noter', label: 'Noter' },
                        { id: 'is_regular', label: 'Regular' }
                      ].map((s) => (
                        <div key={s.id} className="flex items-center gap-3 p-3 border rounded-xl bg-card hover:bg-muted/10">
                          <Checkbox checked={formData[s.id as keyof typeof formData] as boolean} onCheckedChange={(c) => handleInputChange(s.id, c as boolean)} id={`check-${s.id}`} />
                          <label htmlFor={`check-${s.id}`} className="text-sm font-bold cursor-pointer">{s.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="mt-0 space-y-4">
                  <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-tight">
                        <Clock className="h-4 w-4" /> Default Work Schedule
                      </h3>
                      {todayOverride && (
                          <div className="flex flex-col items-end gap-1.5 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20 shadow-sm">
                            <div className="flex items-center gap-1.5 text-[11px] font-black text-orange-500 animate-pulse uppercase tracking-wider">
                                <Clock className="h-3.5 w-3.5" /> OVERRIDE ACTIVE TODAY
                            </div>
                            <div className="text-sm font-black text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/50 px-3 py-1 rounded-md shadow-inner border border-orange-200/50 dark:border-orange-800/50">
                              {convertTo12Hour(todayOverride.am_in)} - {convertTo12Hour(todayOverride.pm_out)}
                            </div>
                          </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pb-4 border-b border-border/20">
                      {[
                        { key: 'am_in', label: 'AM In' },
                        { key: 'am_out', label: 'AM Out' },
                        { key: 'pm_in', label: 'PM In' },
                        { key: 'pm_out', label: 'PM Out' }
                      ].map(({ key, label }) => (
                        <div key={key} className="text-center bg-card rounded-md shadow-sm p-3 border border-border-200">
                          <label className="text-[9px] font-black text-muted-foreground uppercase block mb-2">{label}</label>
                          <Select value={formData[key as keyof typeof formData] as string} onValueChange={(value) => handleInputChange(key, value)}>
                            <SelectTrigger className="w-full text-center text-xs h-7">
                              <SelectValue>{convertTo12Hour(formData[key as keyof typeof formData] as string)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-32">
                              {timeOptions.map((t) => <SelectItem key={t} value={t} className="text-xs">{convertTo12Hour(t)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-muted-foreground uppercase flex items-center gap-2">
                          <Calendar className="h-4 w-4" /> Schedule Overrides (Grouped)
                        </h4>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5 px-2"
                          onClick={() => {
                            // Logic to open bulk edit with this employee selected
                            onClose();
                            window.dispatchEvent(new CustomEvent('openBulkEdit', { detail: { employeeId: employee.employee_id } }));
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Edit Schedule
                        </Button>
                      </div>
                      
                      {loadingOverrides ? (
                        <div className="text-center py-4 text-xs text-muted-foreground">Loading...</div>
                      ) : groupedOverrides.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                          {groupedOverrides.map((group, idx) => (
                            <div key={idx} className="bg-primary/5 border border-primary/20 rounded-lg p-3 hover:bg-primary/10 transition-colors group relative">
                              <div className="flex items-center justify-between mb-3 text-xs">
                                <span className="font-bold text-primary flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5" /> {formatDateRange(group.startDate, group.endDate)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black uppercase tracking-tight">Override</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs text-foreground bg-muted p-2 rounded-md border border-border">
                                 <div><span className="font-black text-primary mr-1 bg-primary/10 px-1 rounded">AM:</span> {convertTo12Hour(group.am_in)} - {convertTo12Hour(group.am_out)}</div>
                                 <div className="w-px h-3 bg-border" />
                                 <div><span className="font-black text-primary mr-1 bg-primary/10 px-1 rounded">PM:</span> {convertTo12Hour(group.pm_in)} - {convertTo12Hour(group.pm_out)}</div>
                              </div>
                              
                              {/* Quick Delete for the whole group range */}
                              <Button 
                                size="icon" 
                                variant="destructive" 
                                className="h-6 w-6 absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                onClick={async () => {
                                  if (window.confirm(`Delete all schedule entries from ${formatDateRange(group.startDate, group.endDate)}?`)) {
                                    try {
                                      setLoadingOverrides(true);
                                      // We need to delete all entries in this range
                                      // The API usually takes an ID, so we loop or use a range endpoint if exists
                                      // Since we only have deleteScheduleOverride(id), we'll assume we need to refresh
                                      // Actually, it's better to just use the clean-up logic but triggered from here
                                      const targets = overrides.filter(o => 
                                        new Date(o.date) >= new Date(group.startDate) && 
                                        new Date(o.date) <= new Date(group.endDate)
                                      );
                                      
                                      for (const t of targets) {
                                        await api.deleteScheduleOverride(t.id);
                                      }
                                      toast.success("Schedule range removed");
                                      fetchOverrides(employee.id);
                                    } catch (e) {
                                      toast.error("Failed to remove range");
                                    } finally {
                                      setLoadingOverrides(false);
                                    }
                                  }
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 border-2 border-dashed border-border rounded-lg text-xs italic text-muted-foreground bg-muted/10">
                          No overrides assigned. Use the "New Override" button above to set a temporary schedule.
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>


              </div>
            </Tabs>

            <div className="border-t border-border pt-4 px-1 flex gap-3 justify-between mt-auto">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsDTRModalOpen(true)} className="font-bold text-xs"><Calendar className="h-3.5 w-3.5 mr-2" /> View DTR</Button>
                {canDeletePrivilege() && (
                  <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:bg-red-50 hover:text-red-600 font-bold text-xs"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} className="font-bold text-xs">Cancel</Button>
                <Button onClick={handleSave} size="sm" className="btn-success font-bold text-xs shadow-md"><Save className="h-3.5 w-3.5 mr-2" /> Save</Button>
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