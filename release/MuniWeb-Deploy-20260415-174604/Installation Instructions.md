# MuniWeb Installation Instructions (Windows)

## 1) Prerequisites

- Node.js 18+
- Python 3.8+
- MySQL Server (XAMPP MySQL is supported)

## 2) Database Initialization

1. Create database `bless_dtr_test`.
2. Generate a sanitized deployment SQL:

```powershell
npm run sanitize:sql
```

3. Import `database.deployment.sql` for customer deployments.
4. Use `database.sql` only for internal/dev use.

## 3) Install Dependencies

In project root:

```bash
npm install
cd server
npm install
cd ..
pip install -r requirements.txt
python -m pip install --upgrade pywin32
```

## 4) Configure Without Code Changes

Recommended guided setup:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

This generates:

- `.env`
- `server/config.json`

Manual templates are available at:

- `.env.example`
- `server/config.example.json`

## 5) Run

- Dev/visible: `run.bat`
- Hidden/background: `START_SYSTEM.vbs`

Open: `http://localhost:8080`

## 5.1) First Login for Deployment SQL

If you imported `database.deployment.sql`:

- Username: `admin`
- Password: `ChangeMe123!`

Change this password immediately after first login.

## 6) Stop

- `stop_app.bat`

## 7) LAN Access

1. Find server IP.
2. Ensure `.env` has `VITE_API_URL=http://SERVER_IP:5000`.
3. Allow ports `5000` and `8080` in Windows Firewall.
4. Client PCs open `http://SERVER_IP:8080`.

## 8) Build a Client Installer Package

From project root:

```powershell
npm run sanitize:sql
npm run release:package
```

The generated ZIP in `release/` is safe to distribute and excludes machine-specific secrets/files.

