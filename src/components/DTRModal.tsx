import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Calculator, Plus, CalendarIcon, Edit, Save, X, Download, FileText, Table, Printer, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, addMonths, getDaysInMonth } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePrivileges } from "@/hooks/usePrivileges";

interface DTRRecord {
  id: number;
  employee_id: number;
  date: string;
  am_in: string;
  am_out: string;
  pm_in: string;
  pm_out: string;
  locked: boolean;
  tardiness?: number;
}

interface Employee {
  id: number;
  employee_id: string;
  name: string;
  position: string;
  office: string;
  signatory: string;  // This is the employee's signatory name
  am_in: string;
  am_out: string;
  pm_in: string;  
  pm_out: string;
}

interface Noter {
  noter_id: number;
  name: string;
  position: string;
  office: string;
  signatory: string;  // Change from boolean to string - this is the actual signatory name
}

interface DTRModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

interface ExportSettings {
  noterSignatory: string;
  noterPosition: string;
  firstMonth: number;
  firstYear: number;
  firstCut: 'full' | 'first' | 'last';
  secondMonth: number;
  secondYear: number;
  secondCut: 'full' | 'first' | 'last';
  exportTo: 'excel' | 'pdf';
}

interface PreviewData {
  employee: {
    id: number;
    name: string;
    position: string;
    office: string;
    signatory: string;
  };
  first_period: {
    month: number;
    year: number;
  };
  noter_signatory: string;
  excelUrl?: string;
  pdfUrl?: string;
}

interface AddDTRFormData {
  date: string;
  am_in: string;
  am_out: string;
  pm_in: string;
  pm_out: string;
  am_in_null: boolean;
  am_out_null: boolean;
  pm_in_null: boolean;
  pm_out_null: boolean;
  locked: boolean;
}

// Add helper function to format tardiness display
const formatTardiness = (minutes: number | null | undefined) => {
  
  if (!minutes || minutes <= 0) return "—";
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes} min`;
  } else if (remainingMinutes === 0) {
    return `${hours} hr`;
  } else {
    return `${hours} hr ${remainingMinutes} min`;
  }
};


// Helper function to detect shift type based on employee schedule
const detectShiftType = (employee: Employee | null): 'morning' | 'mid' | 'night' => {
  if (!employee || !employee.am_in || !employee.pm_out) return 'morning';
  
  const amInHour = parseInt(employee.am_in.split(':')[0]);
  const pmOutHour = parseInt(employee.pm_out.split(':')[0]);
  
  // Night shift: IN around 10PM, OUT around 6AM
  if ((amInHour >= 20 || amInHour <= 2) && (pmOutHour >= 4 && pmOutHour <= 8)) {
    return 'night';
  }
  
  // Mid shift: IN around 6AM, OUT around 2PM
  if ((amInHour >= 5 && amInHour <= 8) && (pmOutHour >= 13 && pmOutHour <= 15)) {
    return 'mid';
  }
  
  // Default to morning shift
  return 'morning';
};

export default function DTRModal({ isOpen, onClose, employee }: DTRModalProps) {
  const currentDate = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(addMonths(currentDate, -1)));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(currentDate));
  const [dtrRecords, setDtrRecords] = useState<DTRRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecords, setEditingRecords] = useState<{ [key: number]: DTRRecord }>({});
  const [noters, setNoters] = useState<Noter[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { canUpdate, canExport, canEditDTR } = usePrivileges();
  const [deletingRecords, setDeletingRecords] = useState<number[]>([]);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    noterSignatory: '',
    noterPosition: '',
    firstMonth: currentDate.getMonth() + 1,
    firstYear: currentDate.getFullYear(),
    firstCut: 'full',
    secondMonth: currentDate.getMonth() + 1,
    secondYear: currentDate.getFullYear(),
    secondCut: 'full',
    exportTo: 'excel'
  });
  
  // Add this function to handle DTR deletion
  const handleDeleteDTR = async (recordId: number) => {
    if (!canUpdate()) {
      toast.info("You don't have permission to delete DTR records");
      return;
    }
    
    if (!confirm("Are you sure you want to delete this DTR record?")) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Add to deleting records list to show loading state
      setDeletingRecords(prev => [...prev, recordId]);
      
      // Assuming you have an api.deleteDTR method
      await api.deleteDTR(recordId);
      
      toast.success('DTR record deleted successfully');
      
      // Remove from deleting list and refresh data
      setDeletingRecords(prev => prev.filter(id => id !== recordId));
      fetchDTR(); // Refresh the DTR list
      
    } catch (error: any) {
      console.error('Failed to delete DTR record:', error);
      toast.error(error.message || 'Failed to delete DTR record');
      setDeletingRecords(prev => prev.filter(id => id !== recordId));
    } finally {
      setLoading(false);
    }
  };

  // Add DTR Dialog States
  const [showAddDTRDialog, setShowAddDTRDialog] = useState(false);
  const [addDTRForm, setAddDTRForm] = useState<AddDTRFormData>({
    date: format(new Date(), "yyyy-MM-dd"),
    am_in: "08:00",
    am_out: "12:00",
    pm_in: "13:00",
    pm_out: "17:00",
    am_in_null: false,
    am_out_null: false,
    pm_in_null: false,
    pm_out_null: false,
    locked: false,
  });
  const [addDTRError, setAddDTRError] = useState<string | null>(null);

  // Detect shift type for current employee
  const shiftType = detectShiftType(employee);

  const formatDateForInput = (dateString: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    const date = new Date(dateString);
    return format(date, "yyyy-MM-dd");
  };

  useEffect(() => {
    if (isOpen && employee) {
      fetchDTR();
      fetchNoters();
    }
  }, [isOpen, employee]);

  
  const fetchDTR = async () => {
    if (!employee) return;
    
    setLoading(true);
    try {
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endDate, "yyyy-MM-dd");
      const data = await api.getDTR(employee.id, start, end);
      setDtrRecords(data);
      setIsEditing(false);
      setEditingRecords({});
    } catch (error) {
      console.error('Failed to fetch DTR records:', error);
      toast.error('Failed to load DTR records');
    } finally {
      setLoading(false);
    }
  };

  // In your fetchNoters function, update the initial settings:
  const fetchNoters = async () => {
    try {
      const data = await api.noters();
      setNoters(data);
      if (data.length > 0) {
        setExportSettings(prev => ({
          ...prev,
          noterSignatory: data[0].signatory,  // Use signatory instead of name
          noterPosition: data[0].position
        }));
      }
    } catch (error) {
      console.error('Failed to fetch noters:', error);
    }
  };

  const handleSearch = () => {
    fetchDTR();
  };

  const handleCalculateTime = () => {
    let totalHours = 0;
    let totalDays = 0;

    dtrRecords.forEach(record => {
      if (record.am_in && record.pm_out) {
        const amIn = new Date(`2000-01-01 ${record.am_in}`);
        const pmOut = new Date(`2000-01-01 ${record.pm_out}`);
        const hoursWorked = (pmOut.getTime() - amIn.getTime()) / (1000 * 60 * 60) - 1;
        totalHours += Math.max(0, hoursWorked);
        totalDays++;
      }
    });

    toast.info(`Total: ${totalDays} days, ${totalHours.toFixed(2)} hours`);
  };

  const handleEditToggle = () => {
    if (!canUpdate()) {
      toast.info("You don't have permission to edit DTR records");
      return;
    }
    
    if (isEditing) {
      setIsEditing(false);
      setEditingRecords({});
    } else {
      const editState: { [key: number]: DTRRecord } = {};
      dtrRecords.forEach(record => {
        editState[record.id] = { ...record };
      });
      setEditingRecords(editState);
      setIsEditing(true);
    }
  };

  // Helper function to format time for display (remove seconds)
  const formatTimeForEdit = (timeString: string | null | undefined) => {
    if (!timeString || timeString === '' || timeString === '00:00:00' || timeString === '00:00') {
      return '';
    }
    // Remove seconds if present
    return timeString.split(':').slice(0, 2).join(':');
  };

  // Helper function to clear a time field - FIXED VERSION
  const handleClearTimeField = (recordId: number, field: string) => {
    setEditingRecords(prev => {
      // Get the current record from editingRecords or create a new one from original
      const currentRecord = prev[recordId] || { ...dtrRecords.find(r => r.id === recordId) };
      
      // Create updated record with cleared field
      const updatedRecord = {
        ...currentRecord,
        [field]: ''  // Set to empty string
      };
      
      return {
        ...prev,
        [recordId]: updatedRecord
      };
    });
  };

  const handleFieldChange = (recordId: number, field: string, value: string | boolean | number) => {
    setEditingRecords(prev => {
      const currentRecord = prev[recordId];
      
      // Get the original record from dtrRecords to use as a base
      const originalRecord = dtrRecords.find(r => r.id === recordId);
      
      // Create updated record, starting with original if it exists
      const updatedRecord = {
        ...(originalRecord || {}),
        ...currentRecord,
        id: recordId,
        [field]: field === 'locked' ? (value === true) : value
      };
      
      return {
        ...prev,
        [recordId]: updatedRecord
      };
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const updatePromises = Object.values(editingRecords).map(async (record) => {
        const originalRecord = dtrRecords.find(r => r.id === record.id);
        
        // Create a clean comparison object
        const originalForComparison = {
          date: originalRecord?.date || '',
          am_in: originalRecord?.am_in || '',
          am_out: originalRecord?.am_out || '',
          pm_in: originalRecord?.pm_in || '',
          pm_out: originalRecord?.pm_out || '',
          locked: originalRecord?.locked || false
        };
        
        const updatedForComparison = {
          date: record.date || '',
          am_in: record.am_in || '',
          am_out: record.am_out || '',
          pm_in: record.pm_in || '',
          pm_out: record.pm_out || '',
          locked: record.locked || false
        };
        
        if (JSON.stringify(originalForComparison) !== JSON.stringify(updatedForComparison)) {
          const dateToSave = /^\d{4}-\d{2}-\d{2}$/.test(record.date) 
            ? record.date 
            : format(new Date(record.date), "yyyy-MM-dd");
            
          return api.updateDTR(record.id, {
            date: dateToSave,
            am_in: record.am_in || '',
            am_out: record.am_out || '',
            pm_in: record.pm_in || '',
            pm_out: record.pm_out || '',
            locked: Boolean(record.locked) // Ensure boolean
          });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);
      toast.success('DTR records updated successfully');
      setIsEditing(false);
      setEditingRecords({});
      fetchDTR();
    } catch (error) {
      console.error('Failed to update DTR records:', error);
      toast.error('Failed to update DTR records');
    } finally {
      setLoading(false);
    }
  };

const handlePreview = async () => {
  if (!employee) return;

  try {
    setLoading(true);
    
    // Prepare preview data - USE SNAKE_CASE to match backend
    const previewData = {
      employee_id: employee.id,
      noter_signatory: exportSettings.noterSignatory,  // Use snake_case
      noter_position: exportSettings.noterPosition,    // Use snake_case
      first_month: exportSettings.firstMonth,
      first_year: exportSettings.firstYear,
      first_cut: exportSettings.firstCut,
      second_month: exportSettings.secondMonth,
      second_year: exportSettings.secondYear,
      second_cut: exportSettings.secondCut
    };

    console.log('🔄 Generating Excel preview...', previewData);

    // Generate Excel preview
    const result = await api.generateExcelPreview(previewData);
    
    if (result.success) {
      // Get the Excel file URL
      const excelUrl = api.getExcelPreviewUrl(result.filename);
      
      // Set preview data with Excel URL
      setPreviewData({
        employee: {
          id: employee.id,
          name: employee.name,
          position: employee.position,
          office: employee.office,
          signatory: employee.signatory
        },
        first_period: {
          month: exportSettings.firstMonth,
          year: exportSettings.firstYear
        },
        noter_signatory: exportSettings.noterSignatory,
        excelUrl: excelUrl
      });
      
      setShowPreview(true);
      setShowExportDialog(false);
      
      toast.success('Excel file generated successfully! Ready for download.');
    } else {
      throw new Error('Failed to generate Excel preview');
    }
    
  } catch (error: any) {
    console.error('❌ Excel preview failed:', error);
    
    let errorMessage = 'Failed to generate Excel preview';
    if (error.message) {
      if (error.message.includes('Template file not found')) {
        errorMessage = 'Excel template not found. Please check the templates folder.';
      } else if (error.message.includes('Employee not found')) {
        errorMessage = 'Employee not found in database.';
      } else if (error.message.includes('Failed to generate Excel preview')) {
        errorMessage = error.message;
      }
    }
    
    toast.error(errorMessage);
  } finally {
    setLoading(false);
  }
};

const handlePrint = async () => {
  if (!employee) return;

  try {
    setLoading(true);
    
    const printData = {
      employee_id: employee.id,
      noter_signatory: exportSettings.noterSignatory,  // Use snake_case
      noter_position: exportSettings.noterPosition,    // Use snake_case
      first_month: exportSettings.firstMonth,
      first_year: exportSettings.firstYear,
      first_cut: exportSettings.firstCut,
      second_month: exportSettings.secondMonth !== 0 ? exportSettings.secondMonth : undefined,
      second_year: exportSettings.secondYear !== 0 ? exportSettings.secondYear : undefined,
      second_cut: exportSettings.secondCut
    };

    console.log('🔄 Generating PDF for printing...', printData);

    // Generate PDF for printing
    const result = await api.generatePrintPDF(printData);
    
    if (result.success) {
      // Get the PDF file URL
      const pdfUrl = api.getPDFPreviewUrl(result.filename);
      
      // Open PDF in new tab for printing
      const printWindow = window.open(pdfUrl, '_blank');
      
      if (printWindow) {
        // Add a small delay to ensure PDF loads before attempting to print
        setTimeout(() => {
          try {
            printWindow.print();
            
            // Close the window after printing (optional)
            printWindow.onafterprint = () => {
              setTimeout(() => {
                printWindow.close();
              }, 1000);
            };
          } catch (error) {
            console.log('Print dialog might have been canceled');
          }
        }, 2000); // Increased delay to ensure PDF loads
      }
      
      toast.success('PDF generated successfully! Opening print dialog...');
      setShowExportDialog(false);
    } else {
      throw new Error('Failed to generate PDF for printing');
    }
    
  } catch (error: any) {
    console.error('❌ Print failed:', error);
    
    let errorMessage = 'Failed to generate PDF for printing';
    if (error.message) {
      if (error.message.includes('Template file not found')) {
        errorMessage = 'PDF template not found. Please check the templates folder.';
      } else if (error.message.includes('Employee not found')) {
        errorMessage = 'Employee not found in database.';
      } else if (error.message.includes('Failed to generate PDF')) {
        errorMessage = error.message;
      }
    }
    
    toast.error(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const getDateRangeString = (month: number, year: number, cut: string) => {
    if (cut === 'full') {
      const daysInMonth = getDaysInMonth(new Date(year, month - 1));
      return `1 - ${daysInMonth}`;
    } else if (cut === 'first') {
      return '1 - 15';
    } else {
      const daysInMonth = getDaysInMonth(new Date(year, month - 1));
      return `16 - ${daysInMonth}`;
    }
  };

  const formatDisplayDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy");
  };

  const formatTimeForDisplay = (timeString: string | null) => {
    if (!timeString || timeString === '00:00:00' || timeString === '00:00') return "—";
    return timeString.replace(':', ' : ');
  };

// Get column headers based on shift type
const getColumnHeaders = () => {
  switch (shiftType) {
    case 'night':
      return {
        timeIn: "Time In (PM/Night)",
        timeOut: "Time Out", 
        timeIn2: "Time In",
        timeOut2: "Time Out (AM/Morning)"
      };
    case 'mid':
    default: // morning and mid use the same format
      return {
        timeIn: "Time In (AM)",
        timeOut: "Time Out (AM)", 
        timeIn2: "Time In (PM)",
        timeOut2: "Time Out (PM)"
      };
  }
};

  // Add DTR Functions
  const handleAddDTRClick = () => {
    if (!canUpdate()) {
      toast.info("You don't have permission to add DTR records");
      return;
    }
    
    // Reset form to current date and default times
    setAddDTRForm({
      date: format(new Date(), "yyyy-MM-dd"),
      am_in: "08:00",
      am_out: "12:00",
      pm_in: "13:00",
      pm_out: "17:00",
      am_in_null: false,
      am_out_null: false,
      pm_in_null: false,
      pm_out_null: false,
      locked: false,
    });
    setAddDTRError(null);
    setShowAddDTRDialog(true);
  };

  const handleAddDTRFieldChange = (field: keyof AddDTRFormData, value: string | boolean) => {
    setAddDTRForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts editing
    if (addDTRError) {
      setAddDTRError(null);
    }
  };

  const handleAddDTRSubmit = async () => {
    if (!employee) return;
    
    setLoading(true);
    setAddDTRError(null);
    
    try {
      // 1. Date Validation
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(addDTRForm.date)) {
        throw new Error("Invalid date format. Please use YYYY-MM-DD format.");
      }
      
      // 2. Time Validation
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
      
      const validateTime = (time: string, fieldName: string, allowEmpty: boolean = true) => {
        if (time && !timeRegex.test(time)) {
          throw new Error(`Invalid time format for ${fieldName}. Please use HH:MM or HH:MM:SS format.`);
        }
      };
      
      if (!addDTRForm.am_in_null) validateTime(addDTRForm.am_in, "AM In");
      if (!addDTRForm.am_out_null) validateTime(addDTRForm.am_out, "AM Out");
      if (!addDTRForm.pm_in_null) validateTime(addDTRForm.pm_in, "PM In");
      if (!addDTRForm.pm_out_null) validateTime(addDTRForm.pm_out, "PM Out");
      
      // 3. Prepare time values (empty string for null, valid time for others)
      const timeData = {
        am_in: addDTRForm.am_in_null ? '' : addDTRForm.am_in,
        am_out: addDTRForm.am_out_null ? '' : addDTRForm.am_out,
        pm_in: addDTRForm.pm_in_null ? '' : addDTRForm.pm_in,
        pm_out: addDTRForm.pm_out_null ? '' : addDTRForm.pm_out,
      };
      
      // 4. Prepare the data for API call
      const dtrData = {
        employee_id: employee.id,
        date: addDTRForm.date,
        am_in: timeData.am_in,
        am_out: timeData.am_out,
        pm_in: timeData.pm_in,
        pm_out: timeData.pm_out,
        locked: addDTRForm.locked ? 1 : 0
      };
      
      console.log('Adding DTR record:', dtrData);
      
      // 5. Call API to add DTR
      // Assuming you have an api.addDTR method
      const result = await api.addDTR(dtrData);
      
      if (result.success) {
        toast.success('DTR record added successfully');
        
        // Close the dialog and refresh the DTR list
        setShowAddDTRDialog(false);
        fetchDTR(); // Refresh the DTR records
        
        // Reset form
        setAddDTRForm({
          date: format(new Date(), "yyyy-MM-dd"),
          am_in: "08:00",
          am_out: "12:00",
          pm_in: "13:00",
          pm_out: "17:00",
          am_in_null: false,
          am_out_null: false,
          pm_in_null: false,
          pm_out_null: false,
          locked: false,
        });
      } else {
        if (result.error?.includes('duplicate') || result.error?.includes('already exists')) {
          throw new Error(`A DTR record already exists for ${addDTRForm.date}`);
        }
        throw new Error(result.error || 'Failed to add DTR record');
      }
      
    } catch (error: any) {
      console.error('Failed to add DTR record:', error);
      setAddDTRError(error.message || 'An unexpected error occurred');
      toast.error(error.message || 'Failed to add DTR record');
    } finally {
      setLoading(false);
    }
  };

  const headers = getColumnHeaders();

  const filteredRecords = dtrRecords.filter(record =>
    formatDisplayDate(record.date).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!employee) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader className="border-b border-border dark:border-gray-700 pb-4">
            <DialogTitle className="text-xl dark:text-white">
              DTR Info (Employee ID {employee.employee_id}) - {shiftType.toUpperCase()} SHIFT
            </DialogTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">{employee.name}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              {shiftType === 'night' && "Night Shift: PM IN = Evening IN, AM OUT = Morning OUT"}
              {shiftType === 'mid' && "Mid Shift: AM IN = Morning IN, AM OUT = Afternoon OUT"} 
              {shiftType === 'morning' && "Morning Shift: Standard AM/PM Schedule"}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Range Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                  From
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600">
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
                <label className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                  To
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600">
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                  Search
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search dates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-0 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  />
                  <Button onClick={handleSearch} size="icon" className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground dark:text-gray-400 invisible">
                  Calculate
                </label>
                <Button 
                  onClick={handleCalculateTime} 
                  className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                  variant="outline"
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate Time
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground dark:text-gray-400 invisible">
                  Export
                </label>
                {/* ADD PRIVILEGE CHECK: Only show export button if user can export */}
                {canExport() && (
                  <Button 
                    onClick={() => setShowExportDialog(true)}
                    className="w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export DTR
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground dark:text-gray-400 invisible">
                  Actions
                </label>
                <div className="flex gap-2">
                  {/* ADD PRIVILEGE CHECK: Only show edit buttons if user can update */}
                  {canUpdate() ? (
                    isEditing ? (
                      <>
                        <Button 
                          onClick={handleSave}
                          className="flex-1 btn-success"
                          disabled={loading}
                          size="sm"
                        >
                          <Save className="mr-1 h-4 w-4" />
                          Save
                        </Button>
                        <Button 
                          onClick={handleEditToggle}
                          className="flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                          variant="outline"
                          disabled={loading}
                          size="sm"
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          onClick={handleEditToggle}
                          className="flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="mr-1 h-4 w-4" />
                          Edit
                        </Button>
                        <Button 
                          onClick={handleAddDTRClick}
                          className="flex-1 btn-success"
                          size="sm"
                          disabled={loading}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add DTR
                        </Button>
                      </>
                    )
                  ) : (
                    // Show message for view-only users
                    <div className="text-sm text-muted-foreground dark:text-gray-400 text-center py-2">
                      View only
                    </div>
                  )}
                </div>
              </div>
            </div>

{/* DTR Table */}
<div className="border rounded-lg dark:border-gray-700">
  <div className="overflow-x-auto">
    <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b bg-muted/50 dark:bg-gray-700/50 dark:border-gray-700">
            <th className="px-4 py-3 text-center text-sm font-medium min-w-[120px] dark:text-white">Date</th>
            <th className="px-4 py-3 text-center text-sm font-medium min-w-[140px] dark:text-white">{headers.timeIn}</th>
            <th className="px-4 py-3 text-center text-sm font-medium min-w-[140px] dark:text-white">{headers.timeOut}</th>
            <th className="px-4 py-3 text-center text-sm font-medium min-w-[140px] dark:text-white">{headers.timeIn2}</th>
            <th className="px-4 py-3 text-center text-sm font-medium min-w-[140px] dark:text-white">{headers.timeOut2}</th>
            {/* Show "Tardiness" in view mode, "Protected" in edit mode */}
            <th className="px-4 py-3 text-center text-sm font-medium min-w-[120px] dark:text-white">
              {isEditing ? "Protected" : "Tardiness"}
            </th>
            {/* Add Delete column header in edit mode */}
            {isEditing && (
              <th className="px-4 py-3 text-center text-sm font-medium min-w-[100px] dark:text-white">
                Actions
              </th>
            )}
          </tr>
        </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={isEditing ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground dark:text-gray-400">
              Loading DTR records...
            </td>
          </tr>
        ) : filteredRecords.length === 0 ? (
          <tr>
            <td colSpan={isEditing ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground dark:text-gray-400">
              No DTR records found for the selected period.
            </td>
          </tr>
        ) : (
          filteredRecords.map((record) => {
            const editingRecord = editingRecords[record.id];
            const currentAmIn = formatTimeForEdit(editingRecord?.am_in ?? record.am_in);
            const currentAmOut = formatTimeForEdit(editingRecord?.am_out ?? record.am_out);
            const currentPmIn = formatTimeForEdit(editingRecord?.pm_in ?? record.pm_in);
            const currentPmOut = formatTimeForEdit(editingRecord?.pm_out ?? record.pm_out);
            
            return (
              <tr key={record.id} className="border-b hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-gray-700/30">
                {/* Date Column */}
                <td className="px-4 py-3 text-sm font-medium text-center align-middle dark:text-white">
                  {isEditing ? (
                    <div className="flex justify-center items-center">
                      <Input
                        type="date"
                        value={formatDateForInput(editingRecords[record.id]?.date || record.date)}
                        onChange={(e) => handleFieldChange(record.id, 'date', e.target.value)}
                        className="w-full min-w-[120px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-full dark:text-white">
                      {formatDisplayDate(record.date)}
                    </div>
                  )}
                </td>
                
                {/* MORNING SHIFT: Time In (AM) */}
                {shiftType === 'morning' && (
                  <>
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentAmIn}
                            onChange={(e) => handleFieldChange(record.id, 'am_in', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60" // Remove seconds, show only hours and minutes
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'am_in')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.am_in)}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentAmOut}
                            onChange={(e) => handleFieldChange(record.id, 'am_out', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'am_out')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.am_out)}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentPmIn}
                            onChange={(e) => handleFieldChange(record.id, 'pm_in', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'pm_in')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.pm_in)}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentPmOut}
                            onChange={(e) => handleFieldChange(record.id, 'pm_out', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'pm_out')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.pm_out)}
                        </div>
                      )}
                    </td>
                  </>
                )}
                
                {/* NIGHT SHIFT: Time In (PM/Night) -> Not Used -> Not Used -> Time Out (AM/Morning) */}
                {shiftType === 'night' && (
                  <>
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentPmIn}
                            onChange={(e) => handleFieldChange(record.id, 'pm_in', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'pm_in')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.am_out)}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value=""
                            onChange={() => {}}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                            disabled
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-8 w-8 p-0 opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          —
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value=""
                            onChange={() => {}}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                            disabled
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-8 w-8 p-0 opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          —
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentAmOut}
                            onChange={(e) => handleFieldChange(record.id, 'am_out', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'am_out')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.pm_in)}
                        </div>
                      )}
                    </td>
                  </>
                )}
                
                {/* MID SHIFT: Time In (AM) -> Time Out (AM) -> Time In (PM) -> Time Out (PM) */}
                {shiftType === 'mid' && (
                  <>
                    {/* Time In (AM) */}
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentAmIn}
                            onChange={(e) => handleFieldChange(record.id, 'am_in', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'am_in')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.am_in)}
                        </div>
                      )}
                    </td>
                    
                    {/* Time Out (AM) - Always empty for mid shift */}
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value=""
                            onChange={() => {}}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                            disabled
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-8 w-8 p-0 opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          —
                        </div>
                      )}
                    </td>
                    
                    {/* Time In (PM) - Always empty for mid shift */}
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value=""
                            onChange={() => {}}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                            disabled
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-8 w-8 p-0 opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          —
                        </div>
                      )}
                    </td>
                    
                    {/* Time Out (PM) - This is where mid shift stores their end time */}
                    <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                      {isEditing ? (
                        <div className="flex justify-center items-center gap-1">
                          <Input
                            type="time"
                            value={currentAmOut}
                            onChange={(e) => handleFieldChange(record.id, 'am_out', e.target.value)}
                            className="w-full min-w-[100px] text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            step="60"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearTimeField(record.id, 'am_out')}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Clear time"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center h-full dark:text-white">
                          {formatTimeForDisplay(record.pm_out)}
                        </div>
                      )}
                    </td>
                  </>
                )}
                
                {/* Last Column: Tardiness in view mode, Protected (locked checkbox) in edit mode */}
                <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                  {isEditing ? (
                    /* EDIT MODE: Show locked checkbox (Protected) */
                    <div className="flex justify-center items-center">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`locked-${record.id}`}
                          checked={Boolean(editingRecord?.locked ?? record.locked)}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setEditingRecords(prev => ({
                              ...prev,
                              [record.id]: {
                                ...(prev[record.id] || { ...record }),
                                locked: isChecked
                              }
                            }));
                          }}
                          className="h-4 w-4 dark:border-gray-500"
                        />
                        <label 
                          htmlFor={`locked-${record.id}`} 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                        >
                          Protected
                        </label>
                      </div>
                    </div>
                  ) : (
                    /* VIEW MODE: Show tardiness */
                    <div className="flex justify-center items-center h-full dark:text-white">
                      {formatTardiness(record.tardiness)}
                    </div>
                  )}
                </td>

                {/* Add Delete column in edit mode */}
                {isEditing && (
                  <td className="px-4 py-3 text-sm text-center align-middle dark:text-white">
                    <div className="flex justify-center items-center">
                      <Button
                        onClick={() => handleDeleteDTR(record.id)}
                        variant="destructive"
                        size="sm"
                        disabled={deletingRecords.includes(record.id) || loading}
                        className="px-2 py-1"
                      >
                        {deletingRecords.includes(record.id) ? (
                          <div className="flex items-center">
                            <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                            Deleting...
                          </div>
                        ) : (
                          'Delete'
                        )}
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
</div>

            {/* Actions */}
            <div className="flex justify-end pt-4">
              <Button onClick={onClose} variant="outline" className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-2xl dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Export DTR</DialogTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Export DTR for {employee.name} ({employee.employee_id}) - {shiftType.toUpperCase()} SHIFT
            </p>
          </DialogHeader>

          <div className="space-y-6">
          {/* Noter Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">Noter Signatory</label>
              <select
                value={exportSettings.noterSignatory}
                onChange={(e) => {
                  const selectedNoter = noters.find(n => n.signatory === e.target.value);
                  setExportSettings(prev => ({
                    ...prev,
                    noterSignatory: e.target.value,
                    noterPosition: selectedNoter?.position || ''
                  }));
                }}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {noters.map((noter) => (
                  <option key={noter.noter_id} value={noter.signatory} className="dark:bg-gray-700">
                    {noter.signatory} - {noter.position} {/* Display the actual signatory name */}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">Noter Position</label>
              <Input
                value={exportSettings.noterPosition}
                onChange={(e) => setExportSettings(prev => ({ ...prev, noterPosition: e.target.value }))}
                placeholder="Enter position"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>

            {/* First Period */}
            <div className="space-y-4">
              <h4 className="font-medium dark:text-white">First Period</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-gray-300">Month</label>
                  <select
                    value={exportSettings.firstMonth}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, firstMonth: parseInt(e.target.value) }))}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1} className="dark:bg-gray-700">
                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-gray-300">Year</label>
                  <Input
                    type="number"
                    value={exportSettings.firstYear}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, firstYear: parseInt(e.target.value) }))}
                    min={2000}
                    max={2100}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-gray-300">Cut-off</label>
                  <select
                    value={exportSettings.firstCut}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, firstCut: e.target.value as any }))}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="full" className="dark:bg-gray-700">Full Month</option>
                    <option value="first" className="dark:bg-gray-700">1st Half (1-15)</option>
                    <option value="last" className="dark:bg-gray-700">2nd Half (16-31)</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Date Range: {getDateRangeString(exportSettings.firstMonth, exportSettings.firstYear, exportSettings.firstCut)}
              </p>
            </div>

            {/* Second Period */}
            <div className="space-y-4">
              <h4 className="font-medium dark:text-white">Second Period (Optional)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-gray-300">Month</label>
                  <select
                    value={exportSettings.secondMonth}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, secondMonth: parseInt(e.target.value) }))}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value={0} className="dark:bg-gray-700">None</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1} className="dark:bg-gray-700">
                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-gray-300">Year</label>
                  <Input
                    type="number"
                    value={exportSettings.secondYear}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, secondYear: parseInt(e.target.value) }))}
                    min={2000}
                    max={2100}
                    className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-gray-300">Cut-off</label>
                  <select
                    value={exportSettings.secondCut}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, secondCut: e.target.value as any }))}
                    className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="full" className="dark:bg-gray-700">Full Month</option>
                    <option value="first" className="dark:bg-gray-700">1st Half (1-15)</option>
                    <option value="last" className="dark:bg-gray-700">2nd Half (16-31)</option>
                  </select>
                </div>
              </div>
              {exportSettings.secondMonth !== 0 && (
                <p className="text-sm text-muted-foreground dark:text-gray-400">
                  Date Range: {getDateRangeString(exportSettings.secondMonth, exportSettings.secondYear, exportSettings.secondCut)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowExportDialog(false)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={loading}
                variant="outline"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
              >
                <Table className="mr-2 h-4 w-4" />
                {loading ? 'Loading...' : 'Download DTR'}
              </Button>
              <Button
                onClick={handlePrint}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
              >
                <Printer className="mr-2 h-4 w-4" />
                {loading ? 'Generating...' : 'VIEW DTR'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

{/* Preview Dialog - Excel File Download */}
<Dialog open={showPreview} onOpenChange={setShowPreview}>
  <DialogContent className="sm:max-w-4xl dark:bg-gray-800 dark:border-gray-700">
    <DialogHeader>
      <DialogTitle className="dark:text-white">DTR Preview - Excel File Ready</DialogTitle>
      <p className="text-sm text-muted-foreground dark:text-gray-400">
        Your Excel file has been generated and is ready for download
      </p>
    </DialogHeader>

    <div className="space-y-6">
      {previewData ? (
        <div className="text-center p-8 border-2 border-dashed border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-800/30 mb-4">
            <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-400 mb-2">
            Excel File Generated Successfully
          </h3>
          
          <p className="text-sm text-green-600 dark:text-green-300 mb-6">
            The DTR Excel file has been created with your selected parameters.
          </p>

          {/* File Information */}
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-6 text-left">
            <h4 className="font-medium mb-3 dark:text-white">File Details:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Employee:</span>
                <p className="font-medium dark:text-white">{previewData.employee.name}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Employee ID:</span>
                <p className="font-medium dark:text-white">{previewData.employee.id}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Period:</span>
                <p className="font-medium dark:text-white">
                  {new Date(previewData.first_period.year, previewData.first_period.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Noter:</span>
                <p className="font-medium dark:text-white">{previewData.noter_signatory}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => {
                if (previewData.excelUrl) {
                  const link = document.createElement('a');
                  link.href = previewData.excelUrl;
                  link.download = `DTR_${previewData.employee.name.replace(/\s+/g, '_')}_${previewData.first_period.month}_${previewData.first_period.year}.xlsx`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              }}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 flex items-center gap-2 text-white"
              size="lg"
            >
              <Download className="h-5 w-5" />
              Download Excel File
            </Button>
            
            <Button
              onClick={() => {
                if (previewData.excelUrl) {
                  window.open(previewData.excelUrl, '_blank');
                }
              }}
              variant="outline"
              className="flex items-center gap-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
              size="lg"
            >
              <FileText className="h-5 w-5" />
              Open in New Tab
            </Button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            The file will be saved in your Downloads folder. You can open it with Microsoft Excel or any spreadsheet application.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Generating Excel file...</p>
          </div>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>

      {/* Add DTR Dialog */}
      <Dialog open={showAddDTRDialog} onOpenChange={setShowAddDTRDialog}>
        <DialogContent className="sm:max-w-md dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add DTR Record</DialogTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Add a new DTR record for {employee?.name}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {addDTRError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{addDTRError}</p>
              </div>
            )}

            {/* Date Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-300">Date *</label>
              <Input
                type="date"
                value={addDTRForm.date}
                onChange={(e) => handleAddDTRFieldChange('date', e.target.value)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            {/* Time Fields with Null Checkboxes */}
            <div className="space-y-4">
              {/* AM In */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium dark:text-gray-300">AM In</label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="am_in_null"
                      checked={addDTRForm.am_in_null}
                      onCheckedChange={(checked) => 
                        handleAddDTRFieldChange('am_in_null', checked === true)
                      }
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor="am_in_null" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                    >
                      Null
                    </label>
                  </div>
                </div>
                <Input
                  type="time"
                  value={addDTRForm.am_in}
                  onChange={(e) => handleAddDTRFieldChange('am_in', e.target.value)}
                  disabled={addDTRForm.am_in_null}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  step="60"
                />
              </div>

              {/* AM Out */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium dark:text-gray-300">AM Out</label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="am_out_null"
                      checked={addDTRForm.am_out_null}
                      onCheckedChange={(checked) => 
                        handleAddDTRFieldChange('am_out_null', checked === true)
                      }
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor="am_out_null" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                    >
                      Null
                    </label>
                  </div>
                </div>
                <Input
                  type="time"
                  value={addDTRForm.am_out}
                  onChange={(e) => handleAddDTRFieldChange('am_out', e.target.value)}
                  disabled={addDTRForm.am_out_null}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  step="60"
                />
              </div>

              {/* PM In */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium dark:text-gray-300">PM In</label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pm_in_null"
                      checked={addDTRForm.pm_in_null}
                      onCheckedChange={(checked) => 
                        handleAddDTRFieldChange('pm_in_null', checked === true)
                      }
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor="pm_in_null" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                    >
                      Null
                    </label>
                  </div>
                </div>
                <Input
                  type="time"
                  value={addDTRForm.pm_in}
                  onChange={(e) => handleAddDTRFieldChange('pm_in', e.target.value)}
                  disabled={addDTRForm.pm_in_null}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  step="60"
                />
              </div>

              {/* PM Out */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium dark:text-gray-300">PM Out</label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pm_out_null"
                      checked={addDTRForm.pm_out_null}
                      onCheckedChange={(checked) => 
                        handleAddDTRFieldChange('pm_out_null', checked === true)
                      }
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor="pm_out_null" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
                    >
                      Null
                    </label>
                  </div>
                </div>
                <Input
                  type="time"
                  value={addDTRForm.pm_out}
                  onChange={(e) => handleAddDTRFieldChange('pm_out', e.target.value)}
                  disabled={addDTRForm.pm_out_null}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  step="60"
                />
              </div>
            </div>

            {/* Locked Checkbox */}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="dtr_locked"
                checked={addDTRForm.locked}
                onCheckedChange={(checked) => 
                  handleAddDTRFieldChange('locked', checked === true)
                }
                className="h-4 w-4"
              />
              <label 
                htmlFor="dtr_locked" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300"
              >
                Locked (prevents overwriting by automated imports)
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddDTRDialog(false)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddDTRSubmit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
              >
                {loading ? 'Adding...' : 'Add DTR Record'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}