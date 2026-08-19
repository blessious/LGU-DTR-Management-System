import { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, FileDown, Upload, RefreshCw, Loader2, Clock, TrendingUp, Users, UserCheck, Briefcase, Sparkles, Menu, X, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import EmployeeInfoModal from "@/components/EmployeeInfoModal";
import MassExportModal from "@/components/MassExportModal";
import SingleDTRModal from "@/components/SingleDTRModal";

interface BiometricDevice {
  biometric_id: number;
  name: string;
  ip_address: string;
  port: number;
  active: boolean;
}

// Helper function to format tardiness minutes to readable format
const formatTardiness = (minutes: number | null) => {
  if (minutes === null || minutes === 0) return "—";
  
  if (minutes < 60) {
    return `${minutes}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
};

// Helper function to get tardiness color class
const getTardinessColor = (minutes: number | null) => {
  if (minutes === null || minutes === 0) return "text-green-600 dark:text-green-400";
  if (minutes <= 30) return "text-yellow-600 dark:text-yellow-400";
  if (minutes <= 60) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
};

export default function Dashboard() {
  const { canImport, canExport, canUpdate, canEditDTR } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stats, setStats] = useState({ total: 0, regular: 0, jobOrder: 0 });
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshRangeOpen, setIsRefreshRangeOpen] = useState(false);
  const [refreshStartDate, setRefreshStartDate] = useState<Date>(new Date());
  const [refreshEndDate, setRefreshEndDate] = useState<Date>(new Date());
  const [isMassExportModalOpen, setIsMassExportModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isSingleDTRModalOpen, setIsSingleDTRModalOpen] = useState(false);

  // Import DTR form state
  const [source, setSource] = useState("Biometric");
  const [biometricDevices, setBiometricDevices] = useState<BiometricDevice[]>([]);
  const [selectedBiometric, setSelectedBiometric] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchAttendance();
  }, [selectedDate]);

  useEffect(() => {
    if (isImportModalOpen && source === "Biometric") {
      fetchBiometricDevices();
    }
  }, [isImportModalOpen, source]);

  const fetchStats = async () => {
    try {
      const data = await api.employeesCount();
      setStats(data);
    } catch (error) {
      toast.error("Failed to load statistics");
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const data = await api.attendance(dateStr);
      
      const attendanceWithTardiness = data.map((record: any) => ({
        ...record,
        tardiness: calculateTardinessForDay(record)
      }));
      
      setAttendance(attendanceWithTardiness);
    } catch (error) {
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate tardiness for a single day
  const calculateTardinessForDay = (attendanceRecord: any) => {
    let totalTardiness = 0;
    
    // Helper function to convert time string to minutes
    const timeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    // Calculate AM tardiness
    if (attendanceRecord.schedule_am_in && attendanceRecord.am_in) {
      const scheduledAM = timeToMinutes(attendanceRecord.schedule_am_in);
      const actualAM = timeToMinutes(attendanceRecord.am_in);
      const amTardiness = Math.max(0, actualAM - scheduledAM);
      totalTardiness += amTardiness;
    }
    
    // Calculate PM tardiness
    if (attendanceRecord.schedule_pm_in && attendanceRecord.pm_in) {
      const scheduledPM = timeToMinutes(attendanceRecord.schedule_pm_in);
      const actualPM = timeToMinutes(attendanceRecord.pm_in);
      const pmTardiness = Math.max(0, actualPM - scheduledPM);
      totalTardiness += pmTardiness;
    }
    
    return totalTardiness > 0 ? totalTardiness : null;
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

  const openRefreshRangeDialog = () => {
    if (!canUpdate()) {
      toast.info("You don't have permission to refresh DTRs");
      return;
    }
    setRefreshStartDate(selectedDate);
    setRefreshEndDate(selectedDate);
    setIsRefreshRangeOpen(true);
  };

  const handleRefreshDTRs = async () => {
    if (refreshStartDate > refreshEndDate) {
      toast.error("Start date cannot be after end date");
      return;
    }

    try {
      setIsRefreshing(true);
      
      const loadingToast = toast.loading("Refreshing DTRs table...", {
        description: "This may take a while. Please wait..."
      });

      const startDateValue = format(refreshStartDate, "yyyy-MM-dd");
      const endDateValue = format(refreshEndDate, "yyyy-MM-dd");
      const result = await api.refreshDTR({ startDate: startDateValue, endDate: endDateValue });
      
      toast.dismiss(loadingToast);
      toast.success("DTRs refreshed successfully", {
        description: `${result.records_processed || 0} DTR day(s) updated from ${format(refreshStartDate, "MMM dd, yyyy")} to ${format(refreshEndDate, "MMM dd, yyyy")}`
      });

      setIsRefreshRangeOpen(false);
      await fetchAttendance();
    } catch (error: any) {
      console.error('Error refreshing DTRs:', error);
      toast.error("Failed to refresh DTRs", {
        description: error.message || "An error occurred while refreshing DTR records"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshAllDTRs = async () => {
    if (!canUpdate()) {
      toast.info("You don't have permission to refresh all DTRs");
      return;
    }
    if (!window.confirm("Refresh all unlocked DTR history from raw imports? This can take longer.")) return;

    try {
      setIsRefreshing(true);
      const loadingToast = toast.loading("Refreshing all DTR history...");
      const result = await api.refreshDTR({ allHistory: true });
      toast.dismiss(loadingToast);
      toast.success("All DTR history refreshed", {
        description: `${result.records_processed || 0} DTR day(s) updated; locked rows were preserved.`
      });
      await fetchAttendance();
    } catch (error: any) {
      toast.error("Failed to refresh all DTR history", { description: error.message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSingleDTR = () => {
    if (!canImport()) {
      toast.info("You don't have permission to import DTR");
      return;
    }
    setIsSingleDTRModalOpen(true);
  };

  const handleImportDTR = async () => {
    if (!canImport()) {
      toast.info("You don't have permission to import DTR");
      return;
    }

    if (isImporting) return;

    try {
      setIsImporting(true);

      if (source === "Biometric") {
        const selectedDevice = biometricDevices.find(
          device => device.biometric_id.toString() === selectedBiometric
        );

        if (!selectedDevice) {
          toast.error("Please select a biometric device");
          return;
        }

        const loadingToast = toast.loading("Importing DTR from biometric...", {
          description: `Connecting to ${selectedDevice.name}...`
        });

        try {
          const result = await api.importDTR({
            source: 'biometric',
            biometric_id: selectedDevice.biometric_id,
            start_date: format(startDate, "yyyy-MM-dd"),
            end_date: format(endDate, "yyyy-MM-dd")
          });

          toast.dismiss(loadingToast);
          toast[result.refresh_success ? "success" : "warning"](result.message, {
            description: `${result.records_inserted} new punch(es); ${result.duplicates_skipped} duplicate(s) skipped.`
          });
          await fetchAttendance();

        } catch (error: any) {
          toast.dismiss(loadingToast);
          throw error;
        }

      } else if (source === "File") {
  if (!selectedFile) {
    toast.error("Please select a file to upload");
    return;
  }

  const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
  if (!['txt', 'xlsx', 'dat'].includes(fileExtension || '')) {
    toast.error("Invalid file type", {
      description: "Please upload a .txt, .xlsx, or .dat file"
    });
    return;
  }

        const loadingToast = toast.loading("Uploading and importing DTR file...", {
          description: `Processing ${selectedFile.name}...`
        });

        try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('start_date', format(startDate, "yyyy-MM-dd"));
          formData.append('end_date', format(endDate, "yyyy-MM-dd"));

          const result = await api.importDTRFile(formData);

          toast.dismiss(loadingToast);
          toast[result.refresh_success ? "success" : "warning"](result.message, {
            description: `${result.records_inserted} new punch(es); ${result.duplicates_skipped} duplicate(s) skipped.`
          });
          await fetchAttendance();

        } catch (error: any) {
          toast.dismiss(loadingToast);
          throw error;
        }
      }

      setIsImportModalOpen(false);
      setSelectedFile(null);

    } catch (error: any) {
      console.error('Import error:', error);
      toast.error("Failed to import DTR", {
        description: error.message || "An error occurred during import"
      });
    } finally {
      setIsImporting(false);
    }
  };

const handleFileSelect = (file: File) => {
  setSelectedFile(file);
  
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    toast.error("File too large", {
      description: "Please select a file smaller than 10MB"
    });
    setSelectedFile(null);
    return;
  }

  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!['txt', 'xlsx', 'dat'].includes(fileExtension || '')) {
    toast.error("Invalid file type", {
      description: "Please upload a .txt, .xlsx, or .dat file"
    });
    setSelectedFile(null);
    return;
  }

  toast.success(`File selected: ${file.name}`);
};

  const filteredData = attendance.filter((record: any) =>
    record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.office?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Enhanced responsive columns configuration
  const getColumns = () => {
    const baseColumns = [
      { key: "id", label: "ID", showOnMobile: true, priority: 1 },
      { key: "name", label: "Name", showOnMobile: true, priority: 1 },
      { key: "office", label: "Office", showOnMobile: false, priority: 2 },
      { key: "am_in", label: "AM In", showOnMobile: false, priority: 3 },
      { key: "am_out", label: "AM Out", showOnMobile: false, priority: 4 },
      { key: "pm_in", label: "PM In", showOnMobile: false, priority: 3 },
      { key: "pm_out", label: "PM Out", showOnMobile: false, priority: 4 },
      { key: "tardiness", label: "Tardiness", showOnMobile: true, priority: 1 },
    ];

    // For mobile, only show priority 1 columns
    if (window.innerWidth < 768) {
      return baseColumns.filter(col => col.priority === 1);
    }
    
    // For tablet, show priority 1 and 2
    if (window.innerWidth < 1024) {
      return baseColumns.filter(col => col.priority <= 2);
    }
    
    // For desktop, show all columns
    return baseColumns;
  };

  const handleRowDoubleClick = async (record: any) => {
    try {
      const employeeData = await api.getEmployeeById(record.id);
      
      const transformedData = {
        id: employeeData.employee_id,
        employee_id: employeeData.employee_id,
        name: employeeData.name,
        position: employeeData.position,
        office: employeeData.office,
        am_in: employeeData.am_in || "08:00",
        am_out: employeeData.am_out || "12:00",
        pm_in: employeeData.pm_in || "13:00",
        pm_out: employeeData.pm_out || "17:00",
        is_registered: Boolean(employeeData.registered),
        is_noter: Boolean(employeeData.noter),
        is_regular: Boolean(employeeData.regular),
        signatory_same_as_name: Boolean(employeeData.signatory)
      };
      
      setSelectedEmployee(transformedData);
      setIsEmployeeModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch employee data:', error);
      toast.error('Failed to load employee information');
    }
  };

  const handleMobileRowClick = (record: any) => {
    setSelectedRecord(selectedRecord?.id === record.id ? null : record);
  };

  const getBiometricDisplayName = (device: BiometricDevice) => {
    return `${device.name} - ${device.ip_address}${device.port ? `:${device.port}` : ''}${!device.active ? ' (Inactive)' : ''}`;
  };

  // Calculate percentage for progress indicators
  const regularPercentage = stats.total > 0 ? (stats.regular / stats.total) * 100 : 0;
  const jobOrderPercentage = stats.total > 0 ? (stats.jobOrder / stats.total) * 100 : 0;

  // Mobile Card View for Attendance
  const MobileAttendanceCard = ({ record }: { record: any }) => (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-3 shadow-sm hover:shadow-md transition-shadow duration-300"
      onClick={() => handleMobileRowClick(record)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{record.name}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{record.office}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${getTardinessColor(record.tardiness)}`}>
          {record.tardiness !== null && <Clock className="h-3 w-3" />}
          {formatTardiness(record.tardiness)}
        </div>
      </div>
      
      {selectedRecord?.id === record.id && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">AM In:</span>
              <p className="font-medium text-gray-900 dark:text-white">{record.am_in || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">AM Out:</span>
              <p className="font-medium text-gray-900 dark:text-white">{record.am_out || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">PM In:</span>
              <p className="font-medium text-gray-900 dark:text-white">{record.pm_in || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">PM Out:</span>
              <p className="font-medium text-gray-900 dark:text-white">{record.pm_out || "—"}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 text-xs dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={(e) => {
              e.stopPropagation();
              handleRowDoubleClick(record);
            }}
          >
            View Details
          </Button>
        </div>
      )}
    </div>
  );

  // Mobile Actions Menu
  const MobileActionsMenu = () => (
    <div className="lg:hidden relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="w-full justify-center dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        Actions
      </Button>
      
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  Date
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className="dark:bg-gray-800"
                />
              </PopoverContent>
            </Popover>
            
            {canImport() && (
              <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
                    <Upload className="mr-1 h-3 w-3" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
                  <DialogHeader>
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-lg dark:text-white">Import DTR</DialogTitle>
                      {/* HIDE Refresh DTRs button for level 2 accounts - similar to DTRModal */}
                      {canEditDTR() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openRefreshRangeDialog}
                          disabled={isRefreshing || isImporting}
                          className="gap-1 text-xs dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          {isRefreshing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Refresh Date
                        </Button>
                      )}
                    </div>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium dark:text-gray-300">Source</label>
                      <Select value={source} onValueChange={setSource} disabled={isImporting}>
                        <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                          <SelectItem value="Biometric" className="dark:text-white dark:focus:bg-gray-600">Biometric</SelectItem>
                          <SelectItem value="File" className="dark:text-white dark:focus:bg-gray-600">File</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

{source === "File" && (
  <div className="space-y-2">
    <label className="text-sm font-medium dark:text-gray-300">Upload File</label>
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
      <input
        type="file"
        accept=".txt,.xlsx,.xls,.dat"
        className="hidden"
        id="mobile-file-upload"
        disabled={isImporting}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelect(file);
          }
        }}
      />
      <label
        htmlFor="mobile-file-upload"
        className={`cursor-pointer flex flex-col items-center gap-1 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Upload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Click to upload</span>
        <p className="text-xs text-gray-500 dark:text-gray-400">TXT, XLSX, or DAT</p>
      </label>
      {selectedFile && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium truncate w-full">
          {selectedFile.name}
        </p>
      )}
    </div>
  </div>
)}

                    {source === "File" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-gray-300">Upload File (.txt, .xlsx, or .dat)</label>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center transition-colors hover:border-blue-300 dark:hover:border-blue-700">
                          <input
                            type="file"
                            accept=".txt,.xlsx,.xls,.dat"  // UPDATED: Added .dat
                            className="hidden"
                            id="file-upload"
                            disabled={isImporting}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileSelect(file);
                              }
                            }}
                          />
                          <label
                            htmlFor="file-upload"
                            className={`cursor-pointer flex flex-col items-center gap-2 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Upload className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                            <div>
                              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Click to upload</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">TXT, XLSX, or DAT files only</p>
                            </div>
                          </label>
                          {selectedFile && (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                              Selected: {selectedFile.name}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium dark:text-gray-300">Start Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="w-full text-xs justify-start dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                              disabled={isImporting}
                            >
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {format(startDate, "MM/dd")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) => date && setStartDate(date)}
                              initialFocus
                              className="dark:bg-gray-800"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium dark:text-gray-300">End Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="w-full text-xs justify-start dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                              disabled={isImporting}
                            >
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {format(endDate, "MM/dd")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
                            <Calendar
                              mode="single"
                              selected={endDate}
                              onSelect={(date) => date && setEndDate(date)}
                              initialFocus
                              className="dark:bg-gray-800"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={handleSingleDTR}
                        className="flex-1 text-xs dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        disabled={isImporting}
                        size="sm"
                      >
                        Single DTR
                      </Button>
                      <Button
                        onClick={handleImportDTR}
                        className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={
                          isImporting ||
                          (source === "Biometric" && (!selectedBiometric || devicesLoading)) ||
                          (source === "File" && !selectedFile)
                        }
                        size="sm"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Importing
                          </>
                        ) : (
                          <>
                            <Upload className="mr-1 h-3 w-3" />
                            Import
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {canExport() && (
              <Button 
                size="sm"
                className="text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setIsMassExportModalOpen(true)}
              >
                <FileDown className="mr-1 h-3 w-3" />
                Export
              </Button>
            )}

            {/* HIDE Refresh DTRs button for level 2 accounts - similar to DTRModal */}
            {canEditDTR() && (
              <Button
                variant="outline"
                size="sm"
                onClick={openRefreshRangeDialog}
                disabled={isRefreshing}
                className="text-xs dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {isRefreshing ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Refresh Date
              </Button>
            )}
            {canEditDTR() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshAllDTRs}
                disabled={isRefreshing}
                className="text-xs dark:text-gray-300"
              >
                Refresh All
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Dashboard"
        searchPlaceholder="Search attendance..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        actions={
          <div className="flex flex-col lg:flex-row gap-2 w-full lg:w-auto">
            {/* Mobile Actions Menu */}
            <MobileActionsMenu />
            
            {/* Desktop Actions */}
            <div className="hidden lg:flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "MMM dd")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="dark:bg-gray-800"
                  />
                </PopoverContent>
              </Popover>
              
              {canImport() && (
                <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isImporting || isRefreshing}>
                      <Upload className="mr-2 h-4 w-4" />
                      Import DTR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
                    <DialogHeader>
                      <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl dark:text-white">Import DTR</DialogTitle>
                        {/* HIDE Refresh DTRs button for level 2 accounts - similar to DTRModal */}
                        {canEditDTR() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={openRefreshRangeDialog}
                            disabled={isRefreshing || isImporting}
                            className="gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                          >
                            {isRefreshing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            Refresh Date
                          </Button>
                        )}
                      </div>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-gray-300">Source</label>
                        <Select value={source} onValueChange={setSource} disabled={isImporting}>
                          <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                            <SelectItem value="Biometric" className="dark:text-white dark:focus:bg-gray-600">Biometric</SelectItem>
                            <SelectItem value="File" className="dark:text-white dark:focus:bg-gray-600">File</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {source === "Biometric" && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium dark:text-gray-300">Select Biometric Device</label>
                          <Select 
                            value={selectedBiometric} 
                            onValueChange={setSelectedBiometric}
                            disabled={devicesLoading || isImporting}
                          >
                            <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                              {devicesLoading ? (
                                <span>Loading devices...</span>
                              ) : (
                                <SelectValue placeholder="Select a biometric device" />
                              )}
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                              {biometricDevices.length === 0 ? (
                                <SelectItem value="none" disabled className="dark:text-gray-400">
                                  No biometric devices found
                                </SelectItem>
                              ) : (
                                biometricDevices.map((device) => (
                                  <SelectItem
                                    key={device.biometric_id}
                                    value={device.biometric_id.toString()}
                                    disabled={!device.active}
                                    className="dark:text-white dark:focus:bg-gray-600"
                                  >
                                    {getBiometricDisplayName(device)}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {biometricDevices.length === 0 && !devicesLoading && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              No biometric devices configured. Please add devices in the biometrics page.
                            </p>
                          )}
                        </div>
                      )}

{source === "File" && (
  <div className="space-y-2">
    <label className="text-sm font-medium dark:text-gray-300">Upload File (.txt, .xlsx, or .dat)</label>
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center transition-colors hover:border-blue-300 dark:hover:border-blue-700">
      <input
        type="file"
        accept=".txt,.xlsx,.xls,.dat"
        className="hidden"
        id="file-upload"
        disabled={isImporting}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelect(file);
          }
        }}
      />
      <label
        htmlFor="file-upload"
        className={`cursor-pointer flex flex-col items-center gap-2 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Upload className="h-8 w-8 text-gray-400 dark:text-gray-500" />
        <div>
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Click to upload</span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">TXT, XLSX, or DAT files only</p>
        </div>
      </label>
      {selectedFile && (
        <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
          Selected: {selectedFile.name}
        </p>
      )}
    </div>
  </div>
)}
                      <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-gray-300">Start Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start text-left font-normal hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                              disabled={isImporting}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(startDate, "MM/dd/yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                            <Calendar
                              mode="single"
                              selected={startDate}
                              onSelect={(date) => date && setStartDate(date)}
                              initialFocus
                              className="dark:bg-gray-800"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium dark:text-gray-300">End Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start text-left font-normal hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                              disabled={isImporting}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(endDate, "MM/dd/yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700">
                            <Calendar
                              mode="single"
                              selected={endDate}
                              onSelect={(date) => date && setEndDate(date)}
                              initialFocus
                              className="dark:bg-gray-800"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleSingleDTR}
                          className="flex-1 hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                          disabled={isImporting}
                        >
                          Single DTR
                        </Button>
                        <Button
                          onClick={handleImportDTR}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={
                            isImporting ||
                            (source === "Biometric" && (!selectedBiometric || devicesLoading)) ||
                            (source === "File" && !selectedFile)
                          }
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Import DTR
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {canExport() && (
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => setIsMassExportModalOpen(true)}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Mass Export
                </Button>
              )}
              <MassExportModal
                isOpen={isMassExportModalOpen}
                onClose={() => setIsMassExportModalOpen(false)}
              />

              {/* HIDE Refresh DTRs button for level 2 accounts - similar to DTRModal */}
              {canEditDTR() && (
                <Button
                  variant="outline"
                  onClick={openRefreshRangeDialog}
                  disabled={isRefreshing}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh Date
                </Button>
              )}
              {canEditDTR() && (
                <Button
                  variant="ghost"
                  onClick={handleRefreshAllDTRs}
                  disabled={isRefreshing}
                  className="dark:text-gray-300"
                >
                  Refresh All
                </Button>
              )}
            </div>
          </div>
        }
      />

      <div className="p-4 lg:p-6 space-y-6">
{/* Enhanced Stats Cards - Responsive Grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Total Employees Card */}
  <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl p-5 overflow-hidden transition-all duration-300 border border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700">
    {/* Decorative Corner Element */}
    <div className="absolute -top-8 -right-8 w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-15 group-hover:scale-125 transition-transform duration-500"></div>
    
    <div className="relative z-10">
      {/* Icon at Top */}
      <div className="inline-flex p-2.5 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-md mb-3 group-hover:scale-105 transition-transform duration-300">
        <Users className="w-6 h-6 text-white" />
      </div>
      
      {/* Number Display */}
      <div className="mb-3">
        <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.total}</p>
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mt-1">Total Employees</p>
      </div>
      
      {/* Info Section */}
      <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">All registered staff members</p>
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Complete workforce overview</span>
        </div>
      </div>
    </div>
  </div>

  {/* Regular Employees Card */}
  <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl p-5 overflow-hidden transition-all duration-300 border border-emerald-100 dark:border-emerald-900 hover:border-emerald-300 dark:hover:border-emerald-700">
    {/* Decorative Corner Element */}
    <div className="absolute -top-8 -right-8 w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full opacity-15 group-hover:scale-125 transition-transform duration-500"></div>
    
    <div className="relative z-10">
      {/* Icon at Top */}
      <div className="inline-flex p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl shadow-md mb-3 group-hover:scale-105 transition-transform duration-300">
        <UserCheck className="w-6 h-6 text-white" />
      </div>
      
      {/* Number Display */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.regular}</p>
          <div className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 rounded-full">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{regularPercentage.toFixed(1)}%</p>
          </div>
        </div>
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mt-1">Regular Employees</p>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${regularPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* Info Section */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Permanent staff members</span>
        </div>
      </div>
    </div>
  </div>

  {/* Job Order Card */}
  <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl p-5 overflow-hidden transition-all duration-300 border border-orange-100 dark:border-orange-900 hover:border-orange-300 dark:hover:border-orange-700">
    {/* Decorative Corner Element */}
    <div className="absolute -top-8 -right-8 w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full opacity-15 group-hover:scale-125 transition-transform duration-500"></div>
    
    <div className="relative z-10">
      {/* Icon at Top */}
      <div className="inline-flex p-2.5 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl shadow-md mb-3 group-hover:scale-105 transition-transform duration-300">
        <Briefcase className="w-6 h-6 text-white" />
      </div>
      
      {/* Number Display */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{stats.jobOrder}</p>
          <div className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900 rounded-full">
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">{jobOrderPercentage.toFixed(1)}%</p>
          </div>
        </div>
        <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide mt-1">Job Order</p>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${jobOrderPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* Info Section */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Contract-based personnel</span>
        </div>
      </div>
    </div>
  </div>
</div>
                 
        {/* Attendance Table - Mobile Card View / Desktop Table View */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Attendance for {format(selectedDate, "MMMM d, yyyy")}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {filteredData.length} records found
            </p>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden p-4">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading attendance...</span>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No attendance records found for this date.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredData.map((record: any, index: number) => (
                  <MobileAttendanceCard key={index} record={record} />
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <DataTable
              columns={getColumns()}
              data={filteredData}
              loading={loading}
              renderRow={(record: any, index: number) => (
                <tr
                  key={index}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 cursor-pointer group"
                  onDoubleClick={() => handleRowDoubleClick(record)}
                >
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{record.id || "—"}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{record.name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">{record.office || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{record.am_in || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{record.am_out || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{record.pm_in || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{record.pm_out || "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className={`flex items-center gap-1 font-medium ${getTardinessColor(record.tardiness)} group-hover:scale-105 transition-transform duration-300`}>
                      {record.tardiness !== null && <Clock className="h-3 w-3" />}
                      {formatTardiness(record.tardiness)}
                    </div>
                  </td>
                </tr>
              )}
            />
          </div>
        </div>
        
      <Dialog open={isRefreshRangeOpen} onOpenChange={setIsRefreshRangeOpen}>
        <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Refresh Date Range</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Recalculate unlocked DTR records from raw imports within this date range.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">Start date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start dark:border-gray-600 dark:text-gray-200">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(refreshStartDate, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
                  <Calendar
                    mode="single"
                    selected={refreshStartDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setRefreshStartDate(date);
                      if (date > refreshEndDate) setRefreshEndDate(date);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">End date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start dark:border-gray-600 dark:text-gray-200">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(refreshEndDate, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="end">
                  <Calendar
                    mode="single"
                    selected={refreshEndDate}
                    onSelect={(date) => date && setRefreshEndDate(date)}
                    disabled={(date) => date < refreshStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsRefreshRangeOpen(false)} disabled={isRefreshing}>
              Cancel
            </Button>
            <Button onClick={handleRefreshDTRs} disabled={isRefreshing} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Dates
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SingleDTRModal
        isOpen={isSingleDTRModalOpen}
        onClose={() => setIsSingleDTRModalOpen(false)}
        onImportSuccess={() => {
          // Optionally refresh attendance data after successful import
          fetchAttendance();
        }}
      />
      </div>
      
      <EmployeeInfoModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        employee={selectedEmployee}
      />
    </div>
  );
}
