import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Upload, Loader2, User, Search, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Employee {
  employee_id: number;
  name: string;
  position: string;
  office: string;
}

interface BiometricDevice {
  biometric_id: number;
  name: string;
  ip_address: string;
  port: number;
  active: boolean;
}

interface SingleDTRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

export default function SingleDTRModal({ isOpen, onClose, onImportSuccess }: SingleDTRModalProps) {
  const [source, setSource] = useState<string>("Biometric");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [biometricDevices, setBiometricDevices] = useState<BiometricDevice[]>([]);
  const [selectedBiometric, setSelectedBiometric] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [unimportedCount, setUnimportedCount] = useState<number | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employee_id.toString().includes(searchTerm) ||
    employee.office.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      if (source === "Biometric") {
        fetchBiometricDevices();
      }
    }
  }, [isOpen, source]);

  useEffect(() => {
    if (selectedEmployee) {
      checkUnimportedRecords();
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const data = await api.employees();
      setEmployees(data);
    } catch (error) {
      toast.error("Failed to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchBiometricDevices = async () => {
    setDevicesLoading(true);
    try {
      const data = await api.biometrics();
      setBiometricDevices(data);
      
      // Set default selected biometric to the first active device
      const activeDevice = data.find((device: BiometricDevice) => device.active);
      if (activeDevice) {
        setSelectedBiometric(activeDevice.biometric_id.toString());
      } else if (data.length > 0) {
        setSelectedBiometric(data[0].biometric_id.toString());
      }
    } catch (error) {
      console.error('Error fetching biometric devices:', error);
      toast.error("Failed to load biometric devices");
    } finally {
      setDevicesLoading(false);
    }
  };

  const checkUnimportedRecords = async () => {
    if (!selectedEmployee) return;
    
    setIsChecking(true);
    try {
      const data = await api.checkUnimportedDTRs(selectedEmployee.employee_id);
      setUnimportedCount(data.count);
    } catch (error) {
      console.error('Error checking unimported records:', error);
      setUnimportedCount(null);
    } finally {
      setIsChecking(false);
    }
  };

const handleFileSelect = (file: File) => {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    toast.error("File too large", {
      description: "Please select a file smaller than 10MB"
    });
    return;
  }

  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!['txt', 'xlsx', 'dat'].includes(fileExtension || '')) {
    toast.error("Invalid file type", {
      description: "Please upload a .txt, .xlsx, or .dat file"
    });
    return;
  }

  setSelectedFile(file);
  toast.success(`File selected: ${file.name}`);
};

  const handleImport = async () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee");
      return;
    }

    if (source === "Biometric" && !selectedBiometric) {
      toast.error("Please select a biometric device");
      return;
    }

    if (source === "File" && !selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsImporting(true);
    try {
      const importData = {
        source: source.toLowerCase(),
        employee_id: selectedEmployee.employee_id,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        ...(source === "Biometric" && { biometric_id: parseInt(selectedBiometric) }),
        ...(source === "File" && { file: selectedFile })
      };

      const result = await api.importSingleDTR(importData);

      toast[result.refresh_success ? "success" : "warning"](result.message, {
        description: `${result.records_inserted} new punch(es); ${result.duplicates_skipped} duplicate(s) skipped.`
      });

      onImportSuccess?.();
      handleClose();

    } catch (error: any) {
      console.error('Single DTR import error:', error);
      toast.error("Failed to import single DTR", {
        description: error.message || "An error occurred during import"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedEmployee(null);
    setSearchTerm("");
    setSelectedFile(null);
    setUnimportedCount(null);
    onClose();
  };

  const getBiometricDisplayName = (device: BiometricDevice) => {
    return `${device.name} - ${device.ip_address}${device.port ? `:${device.port}` : ''}${!device.active ? ' (Inactive)' : ''}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <User className="h-5 w-5" />
            Single DTR Import
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Employee *</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by name, ID, or office..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {employeesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-gray-600">Loading employees...</span>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.employee_id}
                    className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedEmployee?.employee_id === employee.employee_id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => setSelectedEmployee(employee)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{employee.name}</p>
                        <p className="text-xs text-gray-600">ID: {employee.employee_id}</p>
                        <p className="text-xs text-gray-600">{employee.position} • {employee.office}</p>
                      </div>
                      {selectedEmployee?.employee_id === employee.employee_id && (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                ))}
                {filteredEmployees.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No employees found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Unimported Records Check */}
          {selectedEmployee && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Unimported Records Check</p>
                  <p className="text-xs text-gray-600">
                    {isChecking ? (
                      "Checking..."
                    ) : unimportedCount !== null ? (
                      <span className={unimportedCount > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                        {unimportedCount} unimported records found in imports table
                      </span>
                    ) : (
                      "Could not check unimported records"
                    )}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkUnimportedRecords}
                  disabled={isChecking}
                  className="h-8"
                >
                  {isChecking ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Source Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Source *</label>
            <Select value={source} onValueChange={setSource} disabled={isImporting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Biometric">Biometric</SelectItem>
                <SelectItem value="File">File</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Biometric Device Selection */}
          {source === "Biometric" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Biometric Device *</label>
              <Select 
                value={selectedBiometric} 
                onValueChange={setSelectedBiometric}
                disabled={devicesLoading || isImporting}
              >
                <SelectTrigger>
                  {devicesLoading ? (
                    <span>Loading devices...</span>
                  ) : (
                    <SelectValue placeholder="Select device" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {biometricDevices.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No devices found
                    </SelectItem>
                  ) : (
                    biometricDevices.map((device) => (
                      <SelectItem
                        key={device.biometric_id}
                        value={device.biometric_id.toString()}
                        disabled={!device.active}
                      >
                        {getBiometricDisplayName(device)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* File Upload */}
{source === "File" && (
  <div className="space-y-2">
    <label className="text-sm font-medium">Upload File *</label>
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors hover:border-blue-300">
      <input
        type="file"
        accept=".txt,.xlsx,.xls,.dat"
        className="hidden"
        id="single-dtr-file-upload"
        disabled={isImporting}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelect(file);
          }
        }}
      />
      <label
        htmlFor="single-dtr-file-upload"
        className={`cursor-pointer flex flex-col items-center gap-2 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Upload className="h-6 w-6 text-gray-400" />
        <div>
          <span className="text-sm font-medium text-blue-600">Click to upload</span>
          <p className="text-xs text-gray-500 mt-1">TXT, XLSX, or DAT files only</p>
        </div>
      </label>
      {selectedFile && (
        <p className="text-sm text-green-600 mt-2 font-medium truncate">
          Selected: {selectedFile.name}
        </p>
      )}
    </div>
  </div>
)}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal hover:bg-gray-50"
                    disabled={isImporting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-left font-normal hover:bg-gray-50"
                    disabled={isImporting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              isImporting ||
              !selectedEmployee ||
              (source === "Biometric" && (!selectedBiometric || devicesLoading)) ||
              (source === "File" && !selectedFile)
            }
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Single DTR
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
