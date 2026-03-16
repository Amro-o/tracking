# SchoolTrack — Attendance Management System
## Complete Setup & Usage Guide

---

## 📋 What Is This?

SchoolTrack is a **fully offline** school attendance management system that:

- Runs from **one PC** (dean's office) on your local WiFi network
- Allows **multiple admin phones** to connect simultaneously
- Stores all data **locally** — no internet required
- Supports student attendance, teacher check-in/out, holidays, and reports

---

## 🖥 System Requirements

| Component | Requirement |
|-----------|------------|
| Operating System | Windows 10 / 11 |
| Node.js | Version 18 or higher (LTS) |
| RAM | 2 GB minimum |
| Storage | 500 MB free |
| Network | Local WiFi/LAN |

---

## 🚀 Installation (First Time Only)

### Step 1 — Install Node.js

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** (Long Term Support) version
3. Run the installer and click **Next** through all steps
4. Restart the PC after installation

### Step 2 — Copy Files to PC

1. Copy the entire `AttendanceSystem` folder to the PC (e.g., `C:\AttendanceSystem`)
2. Place it somewhere permanent — **do not move it** after setup

### Step 3 — First Launch

1. Double-click `START.bat`
2. It will automatically install dependencies (takes ~1 minute on first run)
3. The server starts and your **browser opens automatically**
4. Default PIN is: **1234** (change it immediately in Settings)

### Step 4 — Auto-Start with Windows (Recommended)

1. Double-click `SETUP_AUTOSTART.bat` as Administrator
2. SchoolTrack will now start automatically every time the PC turns on

### Step 5 — Build EXE Installer (Optional)

If you want a single EXE file for easy installation on multiple PCs:

1. Install **NSIS** from [https://nsis.sourceforge.io/Download](https://nsis.sourceforge.io/Download)
2. Right-click `installer.nsi` → **Compile NSIS Script**
3. `SchoolTrack_Installer.exe` will be created — distribute this to other PCs

---

## 📱 Connecting Admin Phones

1. Make sure the phone is connected to the **same WiFi** as the dean's PC
2. Open the browser on the phone (Chrome recommended)
3. Enter the server address shown in the terminal, e.g.:
   ```
   http://192.168.1.15:3000
   ```
4. Bookmark this address for easy access
5. Enter the PIN when prompted

> **Tip:** To find the IP address, look at the terminal window when SchoolTrack starts — it shows "Network: http://X.X.X.X:3000"

---

## 🔑 Default Credentials

| Setting | Default |
|---------|---------|
| Admin PIN | **1234** |
| Port | **3000** |
| Data folder | `AttendanceSystem/data/` |

**Change the PIN immediately after first login!** (Settings → Change PIN)

---

## 📁 Folder Structure

```
AttendanceSystem/
├── app/
│   ├── index.html     ← Web interface (all screens)
│   ├── styles.css     ← Styles
│   └── app.js         ← Frontend logic
├── data/
│   ├── students.json      ← Student records
│   ├── classes.json       ← Class records
│   ├── teachers.json      ← Teacher records
│   ├── attendance.json    ← Attendance logs
│   ├── teacher_log.json   ← Teacher check-in/out
│   ├── holidays.json      ← Holiday list
│   └── settings.json      ← PIN and school name
├── photos/            ← Student photos
├── reports/
│   ├── daily/         ← Daily report exports
│   └── monthly/       ← Monthly report exports
├── backups/           ← Auto-backups before imports
├── server.js          ← Backend server
├── package.json       ← Node.js config
├── START.bat          ← Launch script
├── SETUP_AUTOSTART.bat
└── installer.nsi      ← Windows EXE builder script
```

---

## 🖥 Screen Guide

### Dashboard
- Overview of today's stats: students present/absent, teachers checked in
- Quick action buttons for common tasks
- Holiday banner when today is a holiday

### Take Attendance
1. Select a date and class
2. Tap **✅ P** (Present), **❌ A** (Absent), or **⏱ L** (Late) for each student
3. Add notes for absences if needed
4. Tap **All Present** / **All Absent** for quick bulk marking
5. Tap **Save Attendance**

### Students
- View all students with search and class filter
- Tap a student to see their full profile and attendance history
- Add/edit/delete students
- Upload student photos

### Classes
- Manage class groups
- Shows student count per class

### Teachers
- View and manage teacher profiles
- Today's check-in status shown for each teacher

### Teacher Check-In (Dean PC)
- Used by teachers when arriving/leaving
- Shows live clock
- Tap **Check In** when arriving, **Check Out** when leaving
- Used for daily and monthly teacher log reports

### Holidays
- Every **Friday** is automatically a holiday
- Manually add: Weather days, Emergencies, National holidays
- Remove manual holidays before finalizing reports

### Reports
Generate and download:
- **Daily Attendance Excel** — all classes for a specific date
- **Daily PDF Report** — printable daily summary
- **Teacher Log Excel** — teacher arrival/departure for a date
- **Monthly Excel** — full month attendance grid per class
- **Teacher Monthly PDF** — monthly teacher log

### Sync & Backup
- **Export Bundle** — downloads all data as a JSON file
- **Import Bundle** — merges data from another admin's export
- Before import, current data is automatically backed up to `backups/`

---

## 🔄 Syncing Between Admin Phones

SchoolTrack is a **server-client** system — all phones talk to the same server, so data is always live and synchronized automatically.

> You do **not** need to manually sync in normal operation. All phones see the same data in real time.

**Use Import/Export when:**
- Setting up a second installation (e.g., a backup laptop)
- Transferring data to a new PC
- Sharing data via USB when WiFi is unavailable

---

## 📊 Reports Explained

### Attendance Status Codes (Monthly Excel)
| Code | Meaning |
|------|---------|
| P | Present |
| A | Absent |
| L | Late |
| E | Excused |
| H | Holiday |
| — | Not marked |

### Holiday Priority
1. **Manual holiday** (highest priority — admin defined)
2. **Friday** (automatic)
3. **Normal school day**

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| Browser doesn't open automatically | Open manually: `http://localhost:3000` |
| Phone can't connect | Ensure phone is on same WiFi; check firewall |
| Forgot PIN | Open `data/settings.json` and change `"pin"` value |
| "node_modules not found" | Run `npm install` in the AttendanceSystem folder |
| Server won't start | Check if port 3000 is used by another app |
| Data lost after update | Data is in `data/` folder — never delete this folder |

### Allow Through Windows Firewall

If phones can't connect, run this in Command Prompt as Administrator:
```
netsh advfirewall firewall add rule name="SchoolTrack" dir=in action=allow protocol=TCP localport=3000
```

---

## 🔒 Security Notes

- The system is **LAN-only** — completely inaccessible from the internet
- PIN protects admin access on all devices
- All data stored locally — no cloud, no external servers
- Teacher check-in is on the dean PC — phone admins cannot modify it
- Backups created automatically before every data import

---

## 📞 Support

This system is self-contained. For customization or issues:
- Check the terminal window for error messages
- Review `data/*.json` files if data issues occur
- Use the Sync > Export feature regularly for backups

---

*SchoolTrack v1.0 — Fully Offline Attendance System*
# tracking
