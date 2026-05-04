# MuniWeb Employee Management System - Complete Analysis

## Database Schema Overview

### Current Database: `bless_dtr_test` (MariaDB 10.4.32)

---

## 1. EMPLOYEES TABLE - Complete Schema

### Table Structure
```sql
CREATE TABLE `employees` (
  `id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `office` varchar(100) NOT NULL,
  `registered` tinyint(4) NOT NULL DEFAULT 0,
  `am_in` time NOT NULL,
  `am_out` time DEFAULT NULL,
  `pm_in` time DEFAULT NULL,
  `pm_out` time NOT NULL,
  `noter` tinyint(4) DEFAULT 0,
  `signatory` varchar(100) DEFAULT NULL,
  `regular` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

### Column Definitions

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `id` | int(10) unsigned | NO | - | Unique employee ID (Primary Key) |
| `name` | varchar(100) | NO | - | Employee full name |
| `position` | varchar(100) | NO | - | Job title/designation |
| `office` | varchar(100) | NO | - | Department/office assignment |
| `registered` | tinyint(4) | NO | 0 | Boolean: Is employee registered? (0=No, 1=Yes) |
| `am_in` | time | NO | - | Standard morning check-in time |
| `am_out` | time | YES | NULL | Standard morning check-out time |
| `pm_in` | time | YES | NULL | Standard afternoon check-in time |
| `pm_out` | time | NO | - | Standard afternoon check-out time |
| `noter` | tinyint(4) | YES | 0 | Boolean: Is employee a noter/approver? (0=No, 1=Yes) |
| `signatory` | varchar(100) | YES | NULL | Signatory name (often same as employee name) |
| `regular` | tinyint(4) | NO | 0 | Boolean: Is employee regular? (0=Job Order/COS, 1=Regular) |

### Employment Status Indicators

The system tracks employee status using three boolean flags:

1. **`registered`** - Whether employee is officially registered in the system
   - 0 = Not registered (inactive/new)
   - 1 = Registered (active)

2. **`noter`** - Whether employee has authority to note/approve DTRs
   - 0 = Regular employee
   - 1 = Has noter/approver privileges

3. **`regular`** - Employment contract type
   - 0 = Job Order (JO) or Contract of Service (COS) - Contractual/temporary
   - 1 = Regular - Permanent employee

### Sample Employee Data
- **Total Employees**: 500+ records
- **Employee ID Range**: 0-6317
- **Active Employees**: Mix of regular, job order, and COS employees
- **Offices**: Multiple municipal departments (Engineering, Health, Agriculture, Social Welfare, etc.)
- **Schedules**: Varied (mostly 8AM-5PM, some with shift variations)

---

## 2. RELATED TABLES

### DTRs Table (Daily Time Records)
```sql
CREATE TABLE `dtrs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int(10) unsigned NOT NULL,
  `date` date NOT NULL,
  `am_in` time DEFAULT NULL,
  `am_out` time DEFAULT NULL,
  `pm_in` time DEFAULT NULL,
  `pm_out` time DEFAULT NULL,
  `locked` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `unique_employee_date` (`employee_id`,`date`),
  KEY `FK_dtrs_employees` (`employee_id`),
  KEY `idx_dtrs_employee_date` (`employee_id`,`date`),
  CONSTRAINT `FK_dtrs_employees` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5589 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

**Purpose**: Stores daily time records for each employee
- **Record Count**: 5,589+
- **Foreign Key**: Links to `employees.id` with CASCADE DELETE
- **Unique Constraint**: One DTR entry per employee per date
- **Indexes**: Fast lookup by employee_id and date range

---

### Imports Table
```sql
CREATE TABLE `imports` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `employee_id` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_imports_employee_created` (`employee_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=27086 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

**Purpose**: Audit trail for biometric data imports
- **Record Count**: 27,086+
- **Tracks**: When biometric data was imported for each employee

---

### Noters Table
```sql
CREATE TABLE `noters` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `office` varchar(100) NOT NULL,
  `signatory` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9368 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

**Purpose**: Defines authoritative note-takers/approvers for DTRs
- **Record Count**: 9,368+
- **Note**: Separate reference table, not directly linked to employees but referenced by name

---

### Officials Table
```sql
CREATE TABLE `officials` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `signatory` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9369 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

**Purpose**: Stores municipal officials' information for DTR signatories
- **Record Count**: 3 records
- **Examples**: Mayor, Vice-Mayor, Administrative Officers

---

### Logs Table
```sql
CREATE TABLE `logs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `admin_id` int(10) unsigned NOT NULL,
  `action` varchar(50) NOT NULL,
  `category` varchar(50) NOT NULL,
  `original` longtext NOT NULL,
  `updated` longtext NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

**Purpose**: Audit log for all administrative actions
- **Tracks**: Who did what (create, update, delete) and when
- **Records Employee Deletions**: Contains detailed before/after snapshots
- **Sample Delete Log**: `action='delete', category='employee', original='employee(id=..., name=..., position=..., ...)'`

---

### Admins Table
```sql
CREATE TABLE `admins` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `level` int(11) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=9258 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

**Admin Levels**:
- Level 1: Read-only/standard user
- Level 2: HR Admin
- Level 3: ICTS Admin (full access)

---

### Biometrics Table
```sql
CREATE TABLE `biometrics` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `ip_address` varchar(50) NOT NULL,
  `port` varchar(50) NOT NULL,
  `active` tinyint(3) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `ip_address` (`ip_address`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=9313 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
```

**Purpose**: Biometric machine/device configuration
- **Active Devices**: Main (192.168.1.83), Market Site (192.168.0.252), RHU (192.168.0.251), etc.

---

## 3. EMPLOYMENT STATUS & TRACKING

### Current Employment Status Implementation

The system uses **boolean flags** rather than an explicit status field:

```
┌─────────────────────────────────────────────────────┐
│ Employee Status Matrix                              │
├──────────┬──────────┬─────────┬─────────────────────┤
│registered│  noter   │ regular │ Status              │
├──────────┼──────────┼─────────┼─────────────────────┤
│    1     │    0     │    1    │ Active Regular      │
│    1     │    1     │    1    │ Active Regular + Noter
│    1     │    0     │    0    │ Active Job Order    │
│    1     │    0     │    0    │ Active COS          │
│    0     │    0     │    0    │ Inactive/Resigned   │
│    0     │    0     │    1    │ Resigned Regular    │
└──────────┴──────────┴─────────┴─────────────────────┘
```

### What's NOT Tracked Currently
- **NO Explicit Resignation Date** - No resignation_date field
- **NO Contract Expiry Tracking** - No end_date for job orders/COS
- **NO Separate Job Order Table** - JO info stored in `regular` flag
- **NO Separate COS Table** - COS info stored in `regular` flag
- **NO Employment History** - No tracking of status changes over time
- **NO Status Transition Log** - No record of when employee became JO, COS, or resigned

---

## 4. EXISTING EMPLOYEE DELETION LOGIC

### Frontend - TypeScript/React

**Location**: `src/lib/api.ts` (Line 316-323)

```typescript
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
}
```

### Backend - Node.js/Express

**Location**: `server/index.js` (Line 595-603)

```javascript
// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/employees/:id:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Behavior**:
- **Direct Hard Delete**: Immediately removes employee from database
- **Cascade Delete**: DTRs are deleted via FK constraint (`ON DELETE CASCADE`)
- **No Audit Log**: Delete action is NOT logged (unlike Python DTR system)
- **No Soft Delete**: No archive or recovery mechanism
- **No Status Update**: Simply removes the record entirely

---

### Python DTR System - Employee Deletion

**Location**: `server/dtr.py` (Line 1161-1177)

```python
def delete_employee(self, id:int|str, commit:bool = True):
    '''
    Delete selected employee
    
    Returns `True` if successfully updated, otherwise `False` \n
    If `commit` is True, automatically commit after updating. Default to `True`
    '''
    if self.__level is None or self.__level < 2:
        raise Exception('Insufficient access privileges')
    
    original_employee = self.get_employee(id)
    if self.__database.delete_employee(id, commit = commit):
        self.__database.add_log(
            admin_id = self.__id,
            action = 'delete',
            category = 'employee',
            original = f'employee(id = {id}, name = {original_employee[1]}, position = {original_employee[2]}, office = {original_employee[3]}, registered = {original_employee[4]}, am_in = {original_employee[5]}, am_out = {original_employee[6]}, pm_in = {original_employee[7]}, pm_out = {original_employee[8]}, noter = {original_employee[9]}, signatory = {original_employee[10]}, regular = {original_employee[11]})',
            updated = f''
        )
        return True
    else:
        return False
```

**Behavior**:
- **Authorization Check**: Requires admin level ≥ 2
- **Audit Trail**: Logs delete action with full employee snapshot
- **Access Control**: Admin level enforcement (HR Admin or ICTS Admin only)

---

## 5. EMPLOYEE MANAGEMENT ENDPOINTS

### Current REST API Endpoints (Node.js)

#### Get All Employees
```
GET /api/employees
```

#### Get Employee by ID
```
GET /api/employees/:id
```

#### Create/Add Employee
```
POST /api/employees
```

#### Update Employee
```
PUT /api/employees/:id
```

#### Delete Employee (Hard Delete)
```
DELETE /api/employees/:id
```

#### Get Employee Positions
```
GET /api/positions
```

#### Get Offices
```
GET /api/offices
```

#### Bulk Edit Schedule
```
POST /api/employees/bulk-schedule
```

#### Bulk Edit Schedule Overrides
```
POST /api/employees/bulk-schedule-overrides
```

---

## 6. MISSING FEATURES - Job Orders & COS Tracking

### Currently NOT Implemented
1. **NO JOB_ORDERS table** - No dedicated table for job order tracking
2. **NO COS_CONTRACTS table** - No dedicated table for COS information
3. **NO CONTRACT EXPIRY** - Cannot track when JO/COS expires
4. **NO EFFECTIVE DATES** - No fields for contract start/end dates
5. **NO RESIGNATION DATE** - Cannot mark when employee resigned
6. **NO RESIGNATION REASON** - Cannot track reason for resignation
7. **NO STATUS HISTORY** - No audit trail of status changes
8. **NO REHIRE TRACKING** - Cannot track if employee was rehired
9. **NO TERMINATION INFO** - Cannot record termination details

### Data Stored in Current System (for JO/COS Employees)
- **Type Identifier**: `regular=0` means Job Order or COS (no distinction)
- **Name & Position**: Standard fields
- **Department**: Office field
- **Schedule**: Same as regular employees
- **Registration Status**: `registered=0` for inactive, `registered=1` for active

---

## 7. EXAMPLE EMPLOYEE RECORDS

### Active Regular Employee
```
ID: 6
Name: Ma. Genoveva G. Loto
Position: Administrative Officer IV
Office: MO - Municipal Information and Library Services Section
registered: 1 (Active)
am_in: 08:00:00
am_out: 12:00:00
pm_in: 13:00:00
pm_out: 17:00:00
noter: 1 (Yes, is Noter)
signatory: Ma. Genoveva G. Loto
regular: 1 (Regular Employee)
```

### Active Job Order Employee
```
ID: 5018
Name: Ellien Lyn M. Mabunga
Position: Administrative Aide I
Office: MO - Information and Communications Technology Sector
registered: 1 (Active)
am_in: 08:00:00
am_out: 12:00:00
pm_in: 13:00:00
pm_out: 17:00:00
noter: 0 (Not Noter)
signatory: NULL
regular: 0 (Job Order/COS)
```

### Inactive/Resigned Employee
```
ID: 1
Name: RONALD MANGUERA
Position: Supervisor
Office: PNP
registered: 0 (Inactive/Resigned)
regular: 0 (Was Job Order)
```

---

## 8. FOREIGN KEY RELATIONSHIPS

```
employees (id)
    ↓
    └─→ dtrs (employee_id) [ON DELETE CASCADE]
        └─→ Automatically deletes all DTRs when employee deleted
    
    └─→ imports (employee_id)
        └─→ References employee_id (no cascade defined)
```

**Cascade Effect**: Deleting an employee automatically deletes:
- All DTR records for that employee
- All related time tracking data

---

## 9. AUDIT & LOGGING

### Logs Table Structure
- **admin_id**: Who performed the action
- **action**: 'create', 'update', 'delete'
- **category**: 'employee', 'dtr', 'import', etc.
- **original**: Snapshot of data before change (for deletes: full employee record)
- **updated**: Snapshot of data after change (for deletes: empty)
- **created_at**: Timestamp of action

### Example Delete Log Entry
```
admin_id: 2 (HR Admin)
action: delete
category: employee
original: employee(id = 5381, name = Reymart S. Malabayabas, 
           position = Administrative Aide I, 
           office = Municipal Engineering Office, 
           registered = 1, am_in = 6:00:00, am_out = 12:00:00, 
           pm_in = 13:00:00, pm_out = 15:00:00, noter = 0, 
           signatory = Reymart S. Malabayabas, regular = 0)
updated: (empty)
created_at: 2025-09-16 08:51:55
```

---

## 10. DEPARTMENTS & OFFICES

### Primary Departments
- Municipal Engineering Office
- Municipal Health Office
- Municipal Agriculture Office
- Municipal Social Welfare and Development Office
- Municipal Treasurer Office
- Municipal Accounting Office
- Office Of The Mayor
- Office Of The Vice Mayor
- SB Secretariat Office
- SB Legislative Office
- Municipal Planning and Development Office
- Municipal Assessor Office
- Municipal Administrator's Office
- MO - Information and Communications Technology Sector
- Commission on Elections
- Department of the Interior and Local Government
- Operations of Market
- Slaughterhouse
- Municipal Civil Registrar's Office
- CAO (City Administrator's Office)
- PNP (Philippine National Police)
- And 30+ more departments/offices

---

## Summary of Key Findings

✅ **IMPLEMENTED**
- Basic employee CRUD operations
- Employment type distinction (regular vs job order/COS via boolean flag)
- DTR tracking with cascade delete
- Audit logging in Python system
- Department/office management
- Noter/approver designation

❌ **NOT IMPLEMENTED**
- Explicit job order table
- Explicit COS (Contract of Service) table
- Resignation date tracking
- Contract expiration dates
- Employment history/timeline
- Status change audit trail
- Soft delete/archiving
- Rehire tracking
- Termination reason tracking
- Contract file storage/management

---

## Recommendations for Enhancement

### Phase 1: Immediate Needs
1. Add `employment_status` field (ACTIVE, RESIGNED, TERMINATED, ON_LEAVE)
2. Add `status_date` field to track when status changed
3. Add `resignation_date` and `resignation_reason` fields
4. Implement soft delete (mark inactive instead of hard delete)

### Phase 2: Job Order & COS Tracking
1. Create `job_orders` table with start/end dates
2. Create `cos_contracts` table with contract terms
3. Link employees to active contracts
4. Add contract status notifications

### Phase 3: Compliance & Audit
1. Implement comprehensive audit trail for all status changes
2. Add employee archive/restore functionality
3. Generate employment history reports
4. Add contract expiration alerts

---

*Last Updated: April 20, 2026*
*Database: bless_dtr_test (MariaDB 10.4.32)*
