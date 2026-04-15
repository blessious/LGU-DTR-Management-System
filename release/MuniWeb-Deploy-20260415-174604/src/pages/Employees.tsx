import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Users, UserCheck, Briefcase, TrendingUp, Sparkles, Calendar } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import EmployeeInfoModal from "@/components/EmployeeInfoModal";
import BulkEditScheduleModal from "@/components/BulkEditScheduleModal";
import { usePrivileges } from "@/hooks/usePrivileges"; 

export default function Employees() {
  const [searchTerm, setSearchTerm] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Stats state
  const [stats, setStats] = useState({ 
    total: 0, 
    regular: 0, 
    jobOrder: 0 
  });

  // Add Employee Form State
  const [addEmployeeLoading, setAddEmployeeLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    signatory: "",
    signatorySameAsName: true,
    position: "",
    office: "",
    am_in: "08:00",
    am_out: "12:00",
    pm_in: "13:00",
    pm_out: "17:00",
    registered: true,
    noter: false,
    regular: true
  });

  const { canCreate, canUpdate, canDelete } = usePrivileges();

  useEffect(() => {
    fetchEmployees();
    fetchStats();

    // Listen for Edit Schedule requests from EmployeeInfoModal
    const handleOpenBulkEdit = (e: any) => {
      setIsBulkEditModalOpen(true);
      // We'll pass the employeeId to the modal via state if needed
      // For now, it just opens the modal as requested
    };

    window.addEventListener('openBulkEdit', handleOpenBulkEdit);
    return () => window.removeEventListener('openBulkEdit', handleOpenBulkEdit);
  }, []);

  useEffect(() => {
    if (isAddEmployeeModalOpen) {
      fetchFormData();
      resetForm();
    }
  }, [isAddEmployeeModalOpen]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await api.employees();
      setEmployees(data);
    } catch (error) {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.employeesCount();
      setStats(data);
    } catch (error) {
      toast.error("Failed to load statistics");
    }
  };

  const fetchFormData = async () => {
    setLoadingData(true);
    try {
      const [positionsRes, officesRes] = await Promise.all([
        fetchPositions(),
        fetchOffices()
      ]);
      setPositions(positionsRes);
      setOffices(officesRes);
    } catch (error) {
      console.error('Failed to fetch form data:', error);
      toast.error("Failed to load positions and offices");
    } finally {
      setLoadingData(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const employees = await api.employees();
      const uniquePositions = Array.from(new Set(employees.map((emp: any) => emp.position).filter(Boolean)));
      return uniquePositions.map(p => ({ position: p }));
    } catch (error) {
      console.error('Error fetching positions:', error);
      return [
        { position: "Administrative Aide I" },
        { position: "Administrative Aide II" },
        { position: "Administrative Aide III" },
        { position: "Administrative Assistant I" },
        { position: "Administrative Assistant II" },
        { position: "Administrative Officer I" },
        { position: "Administrative Officer II" },
        { position: "Administrative Officer III" },
        { position: "Department Head" },
        { position: "Job Order" }
      ];
    }
  };

  const fetchOffices = async () => {
    try {
      const employees = await api.employees();
      const uniqueOffices = Array.from(new Set(employees.map((emp: any) => emp.office).filter(Boolean)));
      return uniqueOffices.map(o => ({ office: o }));
    } catch (error) {
      console.error('Error fetching offices:', error);
      return [
        { office: "Mayor's Office" },
        { office: "Vice Mayor's Office" },
        { office: "Accounting Office" },
        { office: "Budget Office" },
        { office: "Treasurer's Office" },
        { office: "Assessor's Office" },
        { office: "Engineering Office" },
        { office: "Health Office" },
        { office: "Social Welfare Office" }
      ];
    }
  };

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      signatory: "",
      signatorySameAsName: true,
      position: "",
      office: "",
      am_in: "08:00",
      am_out: "12:00",
      pm_in: "13:00",
      pm_out: "17:00",
      registered: true,
      noter: false,
      regular: true
    });
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // If name changes and signatory is same as name, update signatory too
    if (field === 'name' && formData.signatorySameAsName) {
      setFormData(prev => ({
        ...prev,
        signatory: value
      }));
    }
  };

  const handleSignatorySameChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      signatorySameAsName: checked,
      signatory: checked ? prev.name : ""
    }));
  };

  const validateForm = (): boolean => {
    // Employee ID validation
    if (!formData.id.trim()) {
      toast.error("Employee ID is required");
      return false;
    }
    
    const idNumber = parseInt(formData.id);
    if (isNaN(idNumber) || idNumber <= 0) {
      toast.error("Employee ID must be a valid number");
      return false;
    }

    // Name validation
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return false;
    }

    if (formData.name.length < 3) {
      toast.error("Name must be at least 3 characters long");
      return false;
    }

    const nameRegex = /^[a-zA-Z\s.]+$/;
    if (!nameRegex.test(formData.name)) {
      toast.error("Name can only contain letters, spaces, and periods");
      return false;
    }

    // Signatory validation
    if (!formData.signatorySameAsName && !formData.signatory.trim()) {
      toast.error("Signatory is required when not same as name");
      return false;
    }

    // Position validation
    if (!formData.position) {
      toast.error("Position is required");
      return false;
    }

    // Office validation
    if (!formData.office) {
      toast.error("Office is required");
      return false;
    }

    return true;
  };

  // Check if there are unimported DTRs for an employee
  const checkUnimportedDTRs = async (employeeId: number): Promise<boolean> => {
    try {
      const response = await api.checkUnimportedDTRs(employeeId);
      return response.hasUnimported;
    } catch (error) {
      console.error('Error checking unimported DTRs:', error);
      return false;
    }
  };

  // Import DTRs for an employee
  const importEmployeeDTRs = async (employeeId: number) => {
    try {
      await api.refreshDTR(employeeId);
      toast.success('DTR records imported successfully');
    } catch (error: any) {
      console.error('Error importing DTRs:', error);
      toast.error('Failed to import DTR records', {
        description: error.message || 'An error occurred during import'
      });
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setAddEmployeeLoading(true);
    try {
      const employeeId = parseInt(formData.id);
      const employeeData = {
        id: employeeId,
        name: formData.name.trim(),
        position: formData.position,
        office: formData.office,
        registered: formData.registered ? 1 : 0,
        noter: formData.noter ? 1 : 0,
        regular: formData.regular ? 1 : 0,
        signatory: formData.signatorySameAsName ? formData.name.trim() : formData.signatory.trim(),
        am_in: `${formData.am_in}:00`,
        am_out: `${formData.am_out}:00`,
        pm_in: `${formData.pm_in}:00`,
        pm_out: `${formData.pm_out}:00`
      };

      await api.addEmployee(employeeData);
      
      toast.success("Employee added successfully");
      
      // Refresh the employee list and stats
      await Promise.all([fetchEmployees(), fetchStats()]);
      
      // Check for unimported DTRs after adding employee
      const hasUnimportedDTRs = await checkUnimportedDTRs(employeeId);
      
      if (hasUnimportedDTRs) {
        // Show confirmation dialog for importing DTRs
        toast.info(
          `Unimported DTR records found for employee ${employeeId}. Import now?`, 
          {
            duration: 10000, // 10 seconds
            action: {
              label: "Import DTR",
              onClick: async () => {
                await importEmployeeDTRs(employeeId);
              }
            },
            cancel: {
              label: "Later",
              onClick: () => {
                toast.info('You can import DTR records later from the Dashboard');
              }
            }
          }
        );
      }

      setIsAddEmployeeModalOpen(false);
      resetForm();
      
    } catch (error: any) {
      console.error('Error adding employee:', error);
      
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        toast.error("Employee ID already exists");
      } else {
        toast.error(error.message || "Failed to add employee");
      }
    } finally {
      setAddEmployeeLoading(false);
    }
  };

  const handleRowDoubleClick = (emp: any) => {
    if (!canUpdate()) {
      toast.info("You don't have permission to edit employee information");
      return;
    }
    const employeeData = {
      id: emp.employee_id,
      employee_id: emp.employee_id,
      name: emp.name,
      position: emp.position,
      office: emp.office,
      am_in: emp.am_in || "08:00",
      am_out: emp.am_out || "12:00", 
      pm_in: emp.pm_in || "13:00",
      pm_out: emp.pm_out || "17:00",
      is_registered: Boolean(emp.registered),
      is_noter: Boolean(emp.noter),
      is_regular: Boolean(emp.regular),
      signatory_same_as_name: Boolean(emp.signatory)
    };
    
    setSelectedEmployee(employeeData);
    setIsEmployeeModalOpen(true);
  };


  const filteredData = employees.filter((emp: any) =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.office?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id?.toString().includes(searchTerm)
  );

  const columns = [
    { key: "employee_id", label: "Employee ID" },
    { key: "name", label: "Name" },
    { key: "position", label: "Position" },
    { key: "office", label: "Office" },
  ];

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Employees"
        searchPlaceholder="Search employees..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        actions={
        canCreate() ? (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        className="hover:shadow-lg transform hover:scale-105 transition-all duration-300 border-primary/20 hover:border-primary text-primary" 
                        onClick={() => setIsBulkEditModalOpen(true)}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Bulk Edit Schedule
                      </Button>
                      <Button 
                        className="btn-gradient hover:shadow-lg transform hover:scale-105 transition-all duration-300" 
                        onClick={() => setIsAddEmployeeModalOpen(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Employee
                      </Button>
                    </div>
                  ) : null
                }
              />

      <div className="p-6 space-y-6">
        {/* Employees Table */}
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          renderRow={(emp: any, index: number) => (
            <tr
              key={index}
              className="border-b border-border hover:bg-accent/50 transition-all duration-300 cursor-pointer group"
              onDoubleClick={() => handleRowDoubleClick(emp)}
            >
              <td className="px-6 py-4 text-sm text-card-foreground group-hover:text-primary transition-colors">
                {emp.employee_id || "—"}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-card-foreground group-hover:text-primary transition-colors">
                {emp.name || "—"}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground group-hover:text-card-foreground transition-colors">
                {emp.position || "—"}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground group-hover:text-card-foreground transition-colors">
                {emp.office || "—"}
              </td>
            </tr>
          )}
        />
      </div>

      {/* Employee Info Modal */}
      <EmployeeInfoModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        employee={selectedEmployee}
        onEmployeeUpdated={fetchEmployees}
      />

      {/* Bulk Edit Schedule Modal */}
      <BulkEditScheduleModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        onSuccess={fetchEmployees}
      />

<Dialog open={isAddEmployeeModalOpen} onOpenChange={setIsAddEmployeeModalOpen}>
  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
    <DialogHeader className="pb-2">
      <DialogTitle className="text-lg flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Add New Employee
      </DialogTitle>
    </DialogHeader>

    <form onSubmit={handleAddEmployee} className="space-y-4 py-2">
      {/* Employee ID */}
      <div className="space-y-1">
        <Label htmlFor="employeeId" className="text-sm font-medium">
          Employee ID <span className="text-red-500">*</span>
        </Label>
        <Input
          id="employeeId"
          type="number"
          placeholder="Enter employee ID"
          value={formData.id}
          onChange={(e) => handleInputChange('id', e.target.value)}
          disabled={addEmployeeLoading}
          className="w-full"
        />
      </div>

      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name" className="text-sm font-medium">
          Full Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="Enter full name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          disabled={addEmployeeLoading}
          className="w-full"
          minLength={3}
        />
        <p className="text-xs text-muted-foreground">
          Minimum 3 characters, letters, spaces and periods only
        </p>
      </div>

      {/* Signatory */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="signatorySame"
            checked={formData.signatorySameAsName}
            onCheckedChange={handleSignatorySameChange}
            disabled={addEmployeeLoading}
          />
          <Label htmlFor="signatorySame" className="text-sm font-medium">
            Signatory Same as Name
          </Label>
        </div>
        
        {!formData.signatorySameAsName && (
          <div className="space-y-1">
            <Label htmlFor="signatory" className="text-sm font-medium">
              Signatory <span className="text-red-500">*</span>
            </Label>
            <Input
              id="signatory"
              type="text"
              placeholder="Enter signatory name"
              value={formData.signatory}
              onChange={(e) => handleInputChange('signatory', e.target.value)}
              disabled={addEmployeeLoading}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Position & Office in one row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Position */}
        <div className="space-y-1">
          <Label htmlFor="position" className="text-sm font-medium">
            Position <span className="text-red-500">*</span>
          </Label>
          <Input
            id="position"
            list="position-list"
            placeholder="Type or select position"
            value={formData.position}
            onChange={(e) => handleInputChange('position', e.target.value)}
            disabled={addEmployeeLoading || loadingData}
            className="w-full"
          />
          <datalist id="position-list">
            {positions.map((pos, index) => (
              <option key={index} value={pos.position} />
            ))}
          </datalist>
        </div>

        {/* Office */}
        <div className="space-y-1">
          <Label htmlFor="office" className="text-sm font-medium">
            Office <span className="text-red-500">*</span>
          </Label>
          <Input
            id="office"
            list="office-list"
            placeholder="Type or select office"
            value={formData.office}
            onChange={(e) => handleInputChange('office', e.target.value)}
            disabled={addEmployeeLoading || loadingData}
            className="w-full"
          />
          <datalist id="office-list">
            {offices.map((office, index) => (
              <option key={index} value={office.office} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Time Settings */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Work Schedule</Label>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label htmlFor="am_in" className="text-xs font-medium">
              AM In
            </Label>
            <Input
              id="am_in"
              type="time"
              value={formData.am_in}
              onChange={(e) => handleInputChange('am_in', e.target.value)}
              disabled={addEmployeeLoading}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="am_out" className="text-xs font-medium">
              AM Out
            </Label>
            <Input
              id="am_out"
              type="time"
              value={formData.am_out}
              onChange={(e) => handleInputChange('am_out', e.target.value)}
              disabled={addEmployeeLoading}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pm_in" className="text-xs font-medium">
              PM In
            </Label>
            <Input
              id="pm_in"
              type="time"
              value={formData.pm_in}
              onChange={(e) => handleInputChange('pm_in', e.target.value)}
              disabled={addEmployeeLoading}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="pm_out" className="text-xs font-medium">
              PM Out
            </Label>
            <Input
              id="pm_out"
              type="time"
              value={formData.pm_out}
              onChange={(e) => handleInputChange('pm_out', e.target.value)}
              disabled={addEmployeeLoading}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Status Checkboxes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Employee Status</Label>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="registered"
              checked={formData.registered}
              onCheckedChange={(checked) => handleInputChange('registered', checked)}
              disabled={addEmployeeLoading}
            />
            <Label htmlFor="registered" className="text-sm">
              Registered
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="noter"
              checked={formData.noter}
              onCheckedChange={(checked) => handleInputChange('noter', checked)}
              disabled={addEmployeeLoading}
            />
            <Label htmlFor="noter" className="text-sm">
              Noter (Dept. Head)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="regular"
              checked={formData.regular}
              onCheckedChange={(checked) => handleInputChange('regular', checked)}
              disabled={addEmployeeLoading}
            />
            <Label htmlFor="regular" className="text-sm">
              Regular
            </Label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsAddEmployeeModalOpen(false)}
          disabled={addEmployeeLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={addEmployeeLoading}
          className="flex-1 btn-gradient"
        >
          {addEmployeeLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </>
          )}
        </Button>
      </div>
    </form>
  </DialogContent>
</Dialog>
    </div>
  );
}