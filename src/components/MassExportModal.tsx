import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, FileText, Printer, Users, Building, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Employee {
  id: number;
  name: string;
  position: string;
  office: string;
  regular: boolean;
}

interface Noter {
  noter_id?: number;
  name?: string;
  position: string;
  office?: string;
  signatory?: string;
  source?: string;
}

interface MassExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportSettings {
  office: string;
  employeeType: 'all' | 'regular' | 'jobOrder';
  noterSignatory: string;
  noterPosition: string;
  firstMonth: number;
  firstYear: number;
  firstCut: 'full' | 'first' | 'last';
  secondMonth: number;
  secondYear: number;
  secondCut: 'full' | 'first' | 'last';
  useSecondPeriod: boolean;
}

export default function MassExportModal({ isOpen, onClose }: MassExportModalProps) {
  const currentDate = new Date();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [noters, setNoters] = useState<Noter[]>([]);
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<string[]>([]);
  
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    office: '',
    employeeType: 'all',
    noterSignatory: '',
    noterPosition: '',
    firstMonth: currentDate.getMonth() + 1,
    firstYear: currentDate.getFullYear(),
    firstCut: 'full',
    secondMonth: currentDate.getMonth() + 1,
    secondYear: currentDate.getFullYear(),
    secondCut: 'full',
    useSecondPeriod: true, // Changed to true to be initially checked
  });

  useEffect(() => {
    if (isOpen) {
      fetchOffices();
      fetchNoters();
    }
  }, [isOpen]);

  const fetchOffices = async () => {
    try {
      const employees = await api.employees();
      const uniqueOffices = Array.from(new Set(employees.map((emp: any) => emp.office).filter(Boolean))) as string[];
      
      // Sort offices alphabetically
      const sortedOffices = uniqueOffices.sort((a, b) => 
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      
      setOffices(sortedOffices);
      
      if (sortedOffices.length > 0) {
        const firstOffice = sortedOffices[0];
        setExportSettings(prev => ({ ...prev, office: firstOffice }));
        (fetchEmployeesByOffice as any)(firstOffice, 'all');
      }
    } catch (error) {
      console.error('Error fetching offices:', error);
      toast.error('Failed to load offices');
    }
  };

  const fetchNoters = async () => {
    try {
      const notersData = await api.noters();
      setNoters(notersData);
      if (notersData.length > 0) {
        const firstNoter = notersData[0];
        
        setExportSettings(prev => ({
          ...prev,
          noterSignatory: firstNoter.signatory || '', // Use signatory name
          noterPosition: firstNoter.position || ''
        }));
      }
    } catch (error) {
      console.error('Failed to fetch noters:', error);
    }
  };

  const fetchEmployeesByOffice = async (office: string, employeeType: string) => {
    try {
      const allEmployees = await api.employees();
      let filtered = allEmployees.filter((emp: any) => emp.office === office);
      
      if (employeeType === 'regular') {
        filtered = filtered.filter((emp: any) => emp.regular);
      } else if (employeeType === 'jobOrder') {
        filtered = filtered.filter((emp: any) => !emp.regular);
      }
      
      setEmployees(filtered);
      return filtered;
    } catch (error) {
      console.error('Error fetching employees by office:', error);
      toast.error('Failed to load employees');
      return [];
    }
  };

  const handleOfficeChange = (office: string) => {
    setExportSettings(prev => ({ ...prev, office }));
    fetchEmployeesByOffice(office, exportSettings.employeeType);
  };

  const handleEmployeeTypeChange = (employeeType: 'all' | 'regular' | 'jobOrder') => {
    setExportSettings(prev => ({ ...prev, employeeType }));
    if (exportSettings.office) {
      fetchEmployeesByOffice(exportSettings.office, employeeType);
    }
  };

  const handleMassPrint = async () => {
    if (!exportSettings.office) {
      toast.error('Please select an office');
      return;
    }

    if (employees.length === 0) {
      toast.error('No employees found for the selected criteria');
      return;
    }

    if (!exportSettings.noterSignatory || !exportSettings.noterPosition) {
      toast.error('Please select a noter signatory and position');
      return;
    }

    if (!exportSettings.firstMonth || !exportSettings.firstYear) {
      toast.error('Please select a valid month and year');
      return;
    }

    setLoading(true);
    try {
      const printData = {
        office: exportSettings.office,
        employeeType: exportSettings.employeeType,
        noterSignatory: exportSettings.noterSignatory,
        noterPosition: exportSettings.noterPosition,
        firstMonth: exportSettings.firstMonth,
        firstYear: exportSettings.firstYear,
        firstCut: exportSettings.firstCut,
        secondMonth: exportSettings.useSecondPeriod ? exportSettings.secondMonth : 0,
        secondYear: exportSettings.useSecondPeriod ? exportSettings.secondYear : 0,
        secondCut: exportSettings.useSecondPeriod ? exportSettings.secondCut : 'full'
      };

      console.log('🔄 Generating mass PDF...', printData);

      const result = await api.massGeneratePrintPDF(printData);
      
      if (result.success) {
        const pdfUrl = api.getMassPDFPreviewUrl(result.filename);
        
        console.log('=== FRONTEND DEBUG ===');
        console.log('PDF URL:', pdfUrl);
        console.log('Result from API:', result);
        
        // SIMPLE SOLUTION: Always use the link method instead of window.open
        // This is more reliable and only opens ONE tab
        console.log('Opening PDF in new tab via link method...');
        
        const tempLink = document.createElement('a');
        tempLink.href = pdfUrl;
        tempLink.target = '_blank';
        tempLink.rel = 'noopener noreferrer';
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        
        console.log('✅ PDF should be opening in a new tab');
        toast.success(`PDF generated for ${employees.length} employees! Opening in new tab...`);
        
      } else {
        throw new Error('Failed to generate mass PDF');
      }
      
    } catch (error: any) {
      console.error('❌ Mass PDF generation failed:', error);
      
      let errorMessage = 'Failed to generate mass PDF';
      if (error.message.includes('No employees found')) {
        errorMessage = 'No employees found matching the selected criteria.';
      } else if (error.message.includes('Template file not found')) {
        errorMessage = 'PDF template not found. Please check the templates folder.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader className="pb-3 border-b dark:border-gray-700">
          <DialogTitle className="flex items-center gap-2 text-lg dark:text-white">
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Mass Print DTR
          </DialogTitle>
          <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
            Generate DTRs for multiple employees (PDF format)
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Employee Selection Section */}
          <div className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-900/50">
            <div className="flex items-center gap-2 mb-3">
              <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Employee Selection</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Office Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Office <span className="text-red-500">*</span>
                </label>
                <select
                  value={exportSettings.office}
                  onChange={(e) => handleOfficeChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
                >
                  <option value="" className="dark:bg-gray-700 dark:text-gray-300">Select Office</option>
                  {offices.map((office) => (
                    <option key={office} value={office} className="dark:bg-gray-700 dark:text-gray-300">
                      {office}
                    </option>
                  ))}
                </select>
              </div>

              {/* Employee Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee Type</label>
                <select
                  value={exportSettings.employeeType}
                  onChange={(e) => handleEmployeeTypeChange(e.target.value as any)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
                >
                  <option value="all" className="dark:bg-gray-700 dark:text-gray-300">All Employees</option>
                  <option value="regular" className="dark:bg-gray-700 dark:text-gray-300">Regular Only</option>
                  <option value="jobOrder" className="dark:bg-gray-700 dark:text-gray-300">Job Order Only</option>
                </select>
              </div>
            </div>

            {/* Employee Count */}
            {employees.length > 0 && (
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-800 dark:text-blue-200">
                    Employees to include:
                  </span>
                  <span className="bg-blue-600 dark:bg-blue-700 text-white px-2 py-1 rounded text-sm font-bold">
                    {employees.length} employees
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Noter Information Section */}
          <div className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-900/50">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Noter Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Noter Signatory <span className="text-red-500">*</span>
                </label>
                <select
                  value={exportSettings.noterSignatory}
                  onChange={(e) => {
                    const selectedNoter = noters.find(n => n.signatory === e.target.value); // Use signatory for matching
                    setExportSettings(prev => ({
                      ...prev,
                      noterSignatory: e.target.value,
                      noterPosition: selectedNoter?.position || ''
                    }));
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:border-green-500 dark:focus:ring-green-400 dark:focus:border-green-400"
                >
                  {noters.map((noter, index) => (
                    <option key={index} value={noter.signatory} className="dark:bg-gray-700 dark:text-gray-300">
                      {noter.signatory} - {noter.position} {/* Display signatory name */}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Noter Position <span className="text-red-500">*</span>
                </label>
                <Input
                  value={exportSettings.noterPosition}
                  onChange={(e) => setExportSettings(prev => ({ ...prev, noterPosition: e.target.value }))}
                  placeholder="Enter position title"
                  className="p-2 focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Period Settings Section */}
          <div className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-900/50">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Period Settings</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Period */}
              <div className="space-y-3">
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-md dark:bg-gray-800">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-2">First Period</h4>
                  
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Month</label>
                      <select
                        value={exportSettings.firstMonth}
                        onChange={(e) => setExportSettings(prev => ({ ...prev, firstMonth: parseInt(e.target.value) }))}
                        className="w-full p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 h-9 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1} className="dark:bg-gray-700 dark:text-gray-300">
                            {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Year</label>
                      <Input
                        type="number"
                        value={exportSettings.firstYear}
                        onChange={(e) => setExportSettings(prev => ({ ...prev, firstYear: parseInt(e.target.value) }))}
                        min={2000}
                        max={2100}
                        className="text-sm p-1.5 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Cut-off</label>
                      <select
                        value={exportSettings.firstCut}
                        onChange={(e) => setExportSettings(prev => ({ ...prev, firstCut: e.target.value as any }))}
                        className="w-full p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 h-9 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="full" className="dark:bg-gray-700 dark:text-gray-300">Full Month</option>
                        <option value="first" className="dark:bg-gray-700 dark:text-gray-300">1st Half</option>
                        <option value="last" className="dark:bg-gray-700 dark:text-gray-300">2nd Half</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Second Period */}
              <div className="space-y-3">
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-md dark:bg-gray-800">
                  <div className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id="useSecondPeriod"
                      checked={exportSettings.useSecondPeriod}
                      onCheckedChange={(checked) => 
                        setExportSettings(prev => ({ ...prev, useSecondPeriod: checked as boolean }))
                      }
                      className="data-[state=checked]:bg-purple-600 dark:data-[state=checked]:bg-purple-500 h-4 w-4"
                    />
                    <label htmlFor="useSecondPeriod" className="text-sm font-semibold text-gray-800 dark:text-white">
                      Include Second Period
                    </label>
                  </div>
                  
                  {exportSettings.useSecondPeriod && (
                    <div className="grid grid-cols-3 gap-2 mt-2 items-end">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Month</label>
                        <select
                          value={exportSettings.secondMonth}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, secondMonth: parseInt(e.target.value) }))}
                          className="w-full p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-purple-500 dark:focus:ring-purple-400 h-9 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1} className="dark:bg-gray-700 dark:text-gray-300">
                              {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Year</label>
                        <Input
                          type="number"
                          value={exportSettings.secondYear}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, secondYear: parseInt(e.target.value) }))}
                          min={2000}
                          max={2100}
                          className="text-sm p-1.5 focus:ring-1 focus:ring-purple-500 dark:focus:ring-purple-400 h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Cut-off</label>
                        <select
                          value={exportSettings.secondCut}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, secondCut: e.target.value as any }))}
                          className="w-full p-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-purple-500 dark:focus:ring-purple-400 h-9 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="full" className="dark:bg-gray-700 dark:text-gray-300">Full Month</option>
                          <option value="first" className="dark:bg-gray-700 dark:text-gray-300">1st Half</option>
                          <option value="last" className="dark:bg-gray-700 dark:text-gray-300">2nd Half</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {employees.length > 0 
                ? `Ready to generate PDF for ${employees.length} employees`
                : 'Select office and criteria'
              }
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="min-w-20 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleMassPrint}
                disabled={loading || employees.length === 0}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 flex items-center gap-2 min-w-28 disabled:opacity-50 text-white"
              >
                <FileText className="h-4 w-4" />
                {loading ? 'Generating...' : `View PDF`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}