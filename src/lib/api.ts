// lib/api.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = {
  // Get DTR records for employee
  async getDTR(employeeId: number, startDate: string, endDate: string) {
    const response = await fetch(
      `${API_URL}/api/dtr/${employeeId}?startDate=${startDate}&endDate=${endDate}`
    );
    if (!response.ok) throw new Error('Failed to fetch DTR records');
    return response.json();
  },

  async employeesCount() {
    const response = await fetch(`${API_URL}/api/employees/count`);
    if (!response.ok) throw new Error('Failed to fetch employee count');
    return response.json();
  },

  async attendance(date: string) {
    const response = await fetch(`${API_URL}/api/attendance/${date}`);
    if (!response.ok) throw new Error('Failed to fetch attendance');
    return response.json();
  },

  async employees() {
    const response = await fetch(`${API_URL}/api/employees`);
    if (!response.ok) throw new Error('Failed to fetch employees');
    return response.json();
  },

  // Get employee by ID
  async getEmployeeById(id: number) {
    const response = await fetch(`${API_URL}/api/employees/${id}`);
    if (!response.ok) throw new Error('Failed to fetch employee');
    return response.json();
  },

  // Add new employee
  async addEmployee(employeeData: any) {
    const response = await fetch(`${API_URL}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employeeData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add employee');
    }
    return response.json();
  },

// Update employee
async updateEmployee(id: number, employeeData: any) {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(employeeData),
  });
  
  if (!response.ok) {
    // Get the actual error message from backend
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update employee');
  }
  
  return response.json();
},

  async noters() {
    const response = await fetch(`${API_URL}/api/noters`);
    if (!response.ok) throw new Error('Failed to fetch department heads');
    return response.json();
  },

  // Add new department head
  async addNoter(noterData: any) {
    const response = await fetch(`${API_URL}/api/noters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(noterData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add department head');
    }
    return response.json();
  },

  async officials() {
    const response = await fetch(`${API_URL}/api/officials`);
    if (!response.ok) throw new Error('Failed to fetch officials');
    return response.json();
  },

  async admins() {
    const response = await fetch(`${API_URL}/api/admins`);
    if (!response.ok) throw new Error('Failed to fetch admins');
    return response.json();
  },

  async biometrics() {
    const response = await fetch(`${API_URL}/api/biometrics`);
    if (!response.ok) throw new Error('Failed to fetch biometric devices');
    return response.json();
  },

  // Update DTR record
  async updateDTR(id: number, dtrData: {
    date: string;
    am_in?: string;
    am_out?: string;
    pm_in?: string;
    pm_out?: string;
    locked: boolean;
  }) {
    const response = await fetch(`${API_URL}/api/dtr/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dtrData),
    });
    if (!response.ok) throw new Error('Failed to update DTR record');
    return response.json();
  },

  // Import DTR from biometric
  async importDTR(data: {
    source: string;
    biometric_id: number;
    start_date: string;
    end_date: string;
  }) {
    const response = await fetch(`${API_URL}/import-dtr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import DTR');
    }
    
    return response.json();
  },

  // Import DTR from file
  async importDTRFile(formData: FormData) {
    const response = await fetch(`${API_URL}/import-dtr-file`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import DTR file');
    }
    
    return response.json();
  },

  // Refresh DTR table
  async refreshDTR(employeeId?: number) {
    const url = employeeId 
      ? `${API_URL}/refresh-dtr/${employeeId}`
      : `${API_URL}/refresh-dtr`;
      
    const response = await fetch(url, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to refresh DTR');
    }
    
    return response.json();
  },
  
  // Export DTR
  async exportDTR(exportData: {
    employee_id: number;
    noter_signatory: string;
    noter_position: string;
    first_month: number;
    first_year: number;
    first_cut?: 'full' | 'first' | 'last';
    second_month?: number;
    second_year?: number;
    second_cut?: 'full' | 'first' | 'last';
    export_to?: 'excel' | 'pdf';
    preview?: boolean;
    print?: boolean;
    printer_name?: string;
  }) {
    const response = await fetch(`${API_URL}/api/export-dtr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(exportData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to export DTR');
    }
    
    return response.json();
  },

  // Generate PDF for printing (Client-side printing)
  async generatePrintPDF(printData: {
    employee_id: number;
    noter_signatory: string;
    noter_position: string;
    first_month: number;
    first_year: number;
    first_cut?: 'full' | 'first' | 'last';
    second_month?: number;
    second_year?: number;
    second_cut?: 'full' | 'first' | 'last';
  }) {
    const response = await fetch(`${API_URL}/api/dtr/generate-print-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(printData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const message = errorData.error || errorData.message || 'Failed to generate PDF for printing';
      throw new Error(message);
    }
    
    return response.json();
  },

  // Get PDF Preview URL
  getPDFPreviewUrl(filename: string) {
    return `${API_URL}/api/dtr/pdf-preview/${filename}`;
  },

  // DTR Preview
  async previewDTR(previewData: {
    employee_id: number;
    noter_signatory: string;
    noter_position: string;
    first_month: number;
    first_year: number;
    first_cut?: 'full' | 'first' | 'last';
    second_month?: number;
    second_year?: number;
    second_cut?: 'full' | 'first' | 'last';
  }) {
    const response = await fetch(`${API_URL}/api/dtr/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(previewData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to preview DTR');
    }
    
    return response.json();
  },

  // Generate Excel Preview
  async generateExcelPreview(previewData: {
    employee_id: number;
    noter_signatory: string;
    noter_position: string;
    first_month: number;
    first_year: number;
    first_cut?: 'full' | 'first' | 'last';
    second_month?: number;
    second_year?: number;
    second_cut?: 'full' | 'first' | 'last';
  }) {
    const response = await fetch(`${API_URL}/api/dtr/generate-excel-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(previewData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to generate Excel preview');
    }
    
    return response.json();
  },

  // Get Excel Preview URL
  getExcelPreviewUrl(filename: string) {
    return `${API_URL}/api/dtr/excel-preview/${filename}`;
  },

  // Delete employee
  async deleteEmployee(id: number) {
    const response = await fetch(`${API_URL}/api/employees/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete employee');
    }
    return response.json();
  },

  // Get employee positions
  async getEmployeePositions() {
    const response = await fetch(`${API_URL}/api/positions`);
    if (!response.ok) throw new Error('Failed to fetch positions');
    return response.json();
  },

  // Get offices
  async getOffices() {
    const response = await fetch(`${API_URL}/api/offices`);
    if (!response.ok) throw new Error('Failed to fetch offices');
    return response.json();
  },

  // Add to your api.ts file
async getOfficialPositions() {
  const response = await fetch(`${API_URL}/api/officials/positions`);
  if (!response.ok) throw new Error('Failed to fetch official positions');
  return response.json();
},

async addOfficial(officialData: { name: string; position: string; signatory: string }) {
  const response = await fetch(`${API_URL}/api/officials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(officialData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add official');
  }
  return response.json();
},
// Add to your api.ts file
async updateOfficial(id: number, officialData: { name: string; position: string; signatory: string }) {
  const response = await fetch(`${API_URL}/api/officials/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(officialData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update official');
  }
  return response.json();
},

async deleteOfficial(id: number) {
  const response = await fetch(`${API_URL}/api/officials/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete official');
  }
  return response.json();
},
// Add to your api.ts file in the api object

// Update department head
async updateNoter(id: number, noterData: { 
  name: string; 
  position: string; 
  office: string; 
  signatory: string; 
}) {
  const response = await fetch(`${API_URL}/api/noters/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(noterData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update department head');
  }
  return response.json();
},

// Delete department head
async deleteNoter(id: number) {
  const response = await fetch(`${API_URL}/api/noters/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete department head');
  }
  return response.json();
},
// Add to your api.ts file in the api object

// Add biometric device
async addBiometric(biometricData: {
  name: string;
  ip_address: string;
  port: number;
  active: boolean;
}) {
  const response = await fetch(`${API_URL}/api/biometrics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(biometricData),
  });
  
  if (!response.ok) {
    // Try to get error message from response
    let errorMessage = 'Failed to add biometric device';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
},

// Update biometric device
async updateBiometric(id: number, biometricData: {
  name: string;
  ip_address: string;
  port: number;
  active: boolean;
}) {
  const response = await fetch(`${API_URL}/api/biometrics/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(biometricData),
  });
  
  if (!response.ok) {
    let errorMessage = 'Failed to update biometric device';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
},

// Delete biometric device
async deleteBiometric(id: number) {
  const response = await fetch(`${API_URL}/api/biometrics/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    let errorMessage = 'Failed to delete biometric device';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
},
// Add to api.ts
async checkUnimportedDTRs(employeeId: number) {
  const response = await fetch(`${API_URL}/api/check-unimported-dtrs/${employeeId}`);
  if (!response.ok) throw new Error('Failed to check unimported DTRs');
  return response.json();
},

// Add to your api.ts file in the api object

// Mass generate PDF for printing
async massGeneratePrintPDF(printData: {
  office: string;
  employeeType: 'all' | 'regular' | 'jobOrder';
  noterSignatory: string;
  noterPosition: string;
  firstMonth: number;
  firstYear: number;
  firstCut?: 'full' | 'first' | 'last';
  secondMonth?: number;
  secondYear?: number;
  secondCut?: 'full' | 'first' | 'last';
}) {
  const response = await fetch(`${API_URL}/api/dtr/mass-generate-print-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      office: printData.office,
      employeeType: printData.employeeType,
      noter_signatory: printData.noterSignatory,
      noter_position: printData.noterPosition,
      first_month: printData.firstMonth,
      first_year: printData.firstYear,
      first_cut: printData.firstCut || 'full',
      second_month: printData.secondMonth || 0,
      second_year: printData.secondYear || 0,
      second_cut: printData.secondCut || 'full'
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to generate mass PDF');
  }
  
  return response.json();
},

// Get mass PDF download URL
getMassPDFPreviewUrl(filename: string) {
  return `${API_URL}/api/dtr/mass-pdf-preview/${filename}`;
},

// Add to your api.ts file in the api object

// Add admin
async addAdmin(adminData: {
  name: string;
  username: string;
  password: string;
  level: number;
}) {
  const response = await fetch(`${API_URL}/api/admins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(adminData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add admin');
  }
  
  return response.json();
},

// Update admin
async updateAdmin(id: number, adminData: {
  name?: string;
  username?: string;
  password?: string;
  level?: number;
}) {
  const response = await fetch(`${API_URL}/api/admins/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(adminData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update admin');
  }
  
  return response.json();
},

// Delete admin
async deleteAdmin(id: number) {
  const response = await fetch(`${API_URL}/api/admins/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete admin');
  }
  
  return response.json();
},
// Import single DTR for specific employee
async importSingleDTR(importData: {
  source: string;
  biometric_id?: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  file?: File;
}) {
  // Handle file upload separately
  if (importData.source === 'file' && importData.file) {
    const formData = new FormData();
    formData.append('source', importData.source);
    formData.append('employee_id', importData.employee_id.toString());
    formData.append('start_date', importData.start_date);
    formData.append('end_date', importData.end_date);
    formData.append('file', importData.file);

    const response = await fetch(`${API_URL}/import-single-dtr`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import single DTR');
    }
    
    return response.json();
  } else {
    // Handle biometric source
    const response = await fetch(`${API_URL}/import-single-dtr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(importData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to import single DTR');
    }
    
    return response.json();
  }
},
// Add to your api.ts file in the api object
async checkBiometricStatus(device: { ip_address: string; port: number }) {
  const response = await fetch(`${API_URL}/api/biometrics/check-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(device),
  });
  
  if (!response.ok) {
    throw new Error('Failed to check device status');
  }
  
  return response.json();
},

// In api.ts, make sure addDTR function looks like this:
addDTR: async (dtrData: {
  employee_id: number;
  date: string;
  am_in: string;
  am_out: string;
  pm_in: string;
  pm_out: string;
  locked: number;
}) => {
  const response = await fetch(`${API_URL}/api/dtr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dtrData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add DTR record');
  }
  
  return response.json();
},

// Add this to your api object in api.ts
async deleteDTR(id: number) {
  const response = await fetch(`${API_URL}/api/dtr/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete DTR record');
  }
  
  return response.json();
},

// Bulk update schedule
async bulkUpdateSchedule(data: {
  employeeIds: number[];
  schedule: {
    am_in: string;
    am_out: string;
    pm_in: string;
    pm_out: string;
  }
}) {
  const response = await fetch(`${API_URL}/api/employees/bulk-schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to bulk update default schedule');
  }
  
  return response.json();
},

// Bulk update Schedule Override (Specific Dates)
async bulkUpdateScheduleOverrides(data: {
  employeeIds: number[];
  startDate: string;
  endDate: string;
  skipWeekends: boolean;
  schedule: {
    am_in: string;
    am_out: string;
    pm_in: string;
    pm_out: string;
  }
}) {
  const response = await fetch(`${API_URL}/api/employees/bulk-schedule-overrides`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to apply schedule override');
  }
  
  return response.json();
  },

  // Get individual employee schedule overrides
  async getScheduleOverrides(employeeId: number) {
    const response = await fetch(`${API_URL}/api/employees/${employeeId}/overrides`);
    if (!response.ok) throw new Error('Failed to fetch schedule overrides');
    return response.json();
  },

  async deleteScheduleOverride(id: number) {
    const response = await fetch(`${API_URL}/api/employees/overrides/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete schedule override');
    return response.json();
  },

  async getGroupedScheduleOverrides(employeeId: number) {
    const response = await fetch(`${API_URL}/api/employees/${employeeId}/overrides-grouped`);
    if (!response.ok) throw new Error('Failed to fetch grouped schedule overrides');
    return response.json();
  }
};