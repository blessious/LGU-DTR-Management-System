# 🚀 MuniWeb Deployment & Run Guide

Follow this guide to set up and run the **MuniWeb** (DTR System) on a new computer.

## 📋 System Requirements

Before you begin, ensure the following software is installed on the target PC:

1.  **Node.js (v18 or higher)**
    *   [Download Node.js](https://nodejs.org/)
2.  **Python (v3.8 or higher)**
    *   [Download Python](https://www.python.org/)
    *   *Important:* During installation, check the box **"Add Python to PATH"**.
3.  **MySQL Server**
    *   Recommended: Use **XAMPP** for an easy setup of MySQL and Apache.
    *   [Download XAMPP](https://www.apachefriends.org/)
4.  **Git** (Optional)
    *   For cloning the repository.

---

## 🛠️ Installation Steps

### 1. Database Setup
1.  Open **XAMPP Control Panel** and start **MySQL**.
2.  Go to [http://localhost/phpmyadmin](http://localhost/phpmyadmin).
3.  Create a new database named `bless_dtr_test`.
4.  Click on the database, go to the **Import** tab.
5.  Choose the `database.sql` file from the project folder and click **Import**.

### 2. Configure Environment Variables
You need to tell the app where the database and server are located.

#### A. Edit `.env` (in the root folder)
Open `.env` and update the values:
```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=bless_dtr_test
VITE_API_URL=http://localhost:5000
```
*(If the database is on another PC, change `localhost` to that PC's IP address.)*

#### B. Edit `config.json` (inside the `server` folder)
The Python scripts use this file. If it doesn't exist, it will be created automatically, but you should check it:
```json
{
  "database": {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "bless_dtr_test",
    "port": 3306
  },
  "export": {
    "path": "exports"
  }
}
```

### 3. Install Dependencies

Open your terminal/command prompt and run these commands:

#### **A. Frontend Dependencies (Root Folder)**
```bash
npm install
```

#### **B. Backend Dependencies (Server Folder)**
```bash
cd server
npm install
cd ..
```

#### **C. Python Dependencies**
While in the root folder, run:
```bash
pip install -r requirements.txt
```

---

## 🏃 How to Run the App

For a clean experience on a different PC, you have two main options:

### 🏆 Fixed Method: Completely Hidden (Recommended)
1.  Double-click **`START_SYSTEM.vbs`**.
2.  A small message will appear for 3 seconds saying the system is starting, then it will **disappear**.
3.  The system is now running in the background with **zero windows** on your taskbar.
4.  Open your browser to `http://localhost:5173` to use the app.

### Option 2: Visible/Debug Mode
1.  Double-click **`run.bat`**.
2.  This will show the CMD windows. Use this only if you need to see if there are errors (like database connection issues).

---

### 🛑 How to Stop the App
Since the system runs in the background, you cannot close it by "X-ing" a window.
1.  Double-click **`stop_app.bat`**.
2.  This will immediately stop all background processes for the system.

---

## 🌐 Running on a Local Network
To access the app from **other PCs** on the same network:

1.  **Find your IP Address**: Run `get_ip.bat` or type `ipconfig` in CMD.
2.  **Update `.env`**: Set `VITE_API_URL` to `http://YOUR_IP:5000`.
3.  **Access the URL**: Other PCs can then open `http://YOUR_IP:5173` in their browser.
4.  **Firewall**: Ensure Port **5000** (Backend) and **5173** (Frontend) are allowed through the Windows Firewall.

---

## 📂 Troubleshooting
*   **Database Connection Error**: Ensure MySQL is running in XAMPP.
*   **Python Module Not Found**: Re-run `pip install -r requirements.txt`.
*   **Blank Screen**: Ensure the Backend server is running and the `VITE_API_URL` is correct.
