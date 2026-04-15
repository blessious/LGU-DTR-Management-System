import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Loader2, Users, X, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface BulkEditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BulkEditScheduleModal({ isOpen, onClose, onSuccess }: BulkEditScheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [offices, setOffices] = useState<string[]>([]);
  
  const [selectedOffice, setSelectedOffice] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  
  const [target, setTarget] = useState<"default" | "override">("override");
  
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    skipWeekends: true,
    am_in: "08:00",
    am_out: "12:00",
    pm_in: "13:00",
    pm_out: "17:00"
  });

  useEffect(() => {
    if (isOpen) {
      fetchData();
      resetForm();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const emps = await api.employees();
      setEmployees(emps);
      
      const uniqueOffices = Array.from(new Set(emps.map((e: any) => e.office).filter(Boolean))) as string[];
      setOffices(uniqueOffices.sort());
    } catch (error) {
      toast.error("Failed to fetch employees data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    setFormData({
      startDate: firstDay,
      endDate: lastDay,
      skipWeekends: true,
      am_in: "08:00",
      am_out: "12:00",
      pm_in: "13:00",
      pm_out: "17:00"
    });
    setSelectedOffice("all");
    setSearchTerm("");
    setSelectedEmployeeIds([]);
    setTarget("override");
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesOffice = selectedOffice === "all" || emp.office === selectedOffice;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchLower) || 
      emp.employee_id.toString().includes(searchLower) ||
      (emp.office && emp.office.toLowerCase().includes(searchLower));
    
    return matchesOffice && matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(filteredEmployees.map(emp => emp.employee_id));
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const handleSelectEmployee = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(prev => [...prev, id]);
    } else {
      setSelectedEmployeeIds(prev => prev.filter(empId => empId !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedEmployeeIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }
    
    if (target === "override" && (!formData.startDate || !formData.endDate)) {
      toast.error("Please select start and end dates");
      return;
    }
    
    if (target === "override" && new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error("Start date cannot be later than end date");
      return;
    }

    setSubmitting(true);
    try {
      if (target === "override") {
        await api.bulkUpdateScheduleOverrides({
          employeeIds: selectedEmployeeIds,
          startDate: formData.startDate,
          endDate: formData.endDate,
          skipWeekends: formData.skipWeekends,
          schedule: {
            am_in: `${formData.am_in}:00`,
            am_out: `${formData.am_out}:00`,
            pm_in: `${formData.pm_in}:00`,
            pm_out: `${formData.pm_out}:00`
          }
        });
      } else {
        await api.bulkUpdateSchedule({
          employeeIds: selectedEmployeeIds,
          schedule: {
            am_in: `${formData.am_in}:00`,
            am_out: `${formData.am_out}:00`,
            pm_in: `${formData.pm_in}:00`,
            pm_out: `${formData.pm_out}:00`
          }
        });
      }
      
      toast.success(`Successfully updated schedule for ${selectedEmployeeIds.length} employees`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update bulk schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Bulk Edit Schedule
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Apply temporary schedule overrides or update the official default schedule.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
              {/* Left Column: Employee Selection */}
              <div className="md:col-span-1 space-y-4 flex flex-col h-[500px] md:h-full">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Filter by Office</Label>
                  <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Offices" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Offices</SelectItem>
                      {offices.map(office => (
                        <SelectItem key={office} value={office}>{office}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">Search Employee</Label>
                  <div className="relative">
                    <Input 
                      placeholder="ID, Name, or Office..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                    <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col border rounded-md overflow-hidden">
                  <div className="bg-muted px-3 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="select-all" 
                        checked={filteredEmployees.length > 0 && selectedEmployeeIds.length === filteredEmployees.length}
                        onCheckedChange={handleSelectAll}
                      />
                      <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                        Select All
                      </Label>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {selectedEmployeeIds.length} Selected
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 bg-background">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        No employees found.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredEmployees.map(emp => (
                          <div 
                            key={emp.employee_id} 
                            className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-md transition-colors"
                          >
                            <Checkbox 
                              id={`emp-${emp.employee_id}`} 
                              checked={selectedEmployeeIds.includes(emp.employee_id)}
                              onCheckedChange={(checked) => handleSelectEmployee(emp.employee_id, checked as boolean)}
                            />
                            <Label htmlFor={`emp-${emp.employee_id}`} className="text-sm cursor-pointer flex-1 truncate">
                              {emp.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Right Column: Schedule Settings */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Target Type Settings */}
                <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-border/50">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Edit Target
                  </h3>
                  
                  <div className="flex flex-col space-y-3 pt-2">
                    <div className="flex items-start space-x-3">
                      <input 
                        type="radio" 
                        id="target-override" 
                        name="target-type"
                        className="mt-0.5 w-4 h-4 text-primary focus:ring-primary border-gray-300 cursor-pointer"
                        checked={target === "override"}
                        onChange={() => setTarget("override")}
                      />
                      <div>
                        <Label htmlFor="target-override" className="text-sm font-medium cursor-pointer">
                          Setting Schedule (Specific Dates)
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Creates an official schedule override for the selected employees on specific dates.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <input 
                        type="radio" 
                        id="target-default" 
                        name="target-type"
                        className="mt-0.5 w-4 h-4 text-primary focus:ring-primary border-gray-300 cursor-pointer"
                        checked={target === "default"}
                        onChange={() => setTarget("default")}
                      />
                      <div>
                        <Label htmlFor="target-default" className="text-sm font-medium cursor-pointer">
                          Update Default Schedule
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Changes the official global schedule assigned to the employee natively.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Date Range Settings (only if target is override) */}
                {target === "override" && (
                  <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-border/50">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Date Range & Options
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="startDate">Start Date <span className="text-red-500">*</span></Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={e => setFormData({...formData, startDate: e.target.value})}
                          required={target === "override"}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="endDate">End Date <span className="text-red-500">*</span></Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={e => setFormData({...formData, endDate: e.target.value})}
                          required={target === "override"}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox 
                        id="skipWeekends" 
                        checked={formData.skipWeekends}
                        onCheckedChange={(checked) => setFormData({...formData, skipWeekends: checked as boolean})}
                      />
                      <Label htmlFor="skipWeekends" className="text-sm cursor-pointer">
                        Skip Weekends (Saturday & Sunday)
                      </Label>
                    </div>
                  </div>
                )}
                
                {/* Time Settings */}
                <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-border/50">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Schedule Times
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="am_in">AM In</Label>
                      <Input
                        id="am_in"
                        type="time"
                        value={formData.am_in}
                        onChange={e => setFormData({...formData, am_in: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="am_out">AM Out</Label>
                      <Input
                        id="am_out"
                        type="time"
                        value={formData.am_out}
                        onChange={e => setFormData({...formData, am_out: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pm_in">PM In</Label>
                      <Input
                        id="pm_in"
                        type="time"
                        value={formData.pm_in}
                        onChange={e => setFormData({...formData, pm_in: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pm_out">PM Out</Label>
                      <Input
                        id="pm_out"
                        type="time"
                        value={formData.pm_out}
                        onChange={e => setFormData({...formData, pm_out: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 p-6 border-t bg-muted/10 mt-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="font-bold text-xs px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || selectedEmployeeIds.length === 0}
              className="min-w-[140px] btn-gradient font-bold text-xs shadow-lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Schedule
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
