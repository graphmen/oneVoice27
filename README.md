# SHEPHERD360

**One Voice 27 Pastoral Visitation Management System**

Connecting Shepherds. Caring for Members.

A Next.js system for Adventist pastors, church clerks and conference administrators. It schedules pastoral visits, verifies that a shepherd physically reached a member’s home (GPS geofence + confirmation), and gives leaders a clear picture of whether the flock is being cared for on the road to September 2027.

Live product identity: [One Voice 27](https://onevoice27.org/) · Firebase project `onevoice27-f9270` · GitHub [graphmen/oneVoice27](https://github.com/graphmen/oneVoice27)

## What it does

- Role-based access: Master Administrator, Church Administrator, Pastor
- Member profiles with home GPS and configurable geofence
- Automatic due dates from visitation frequency
- Priority queue (new members, crisis, follow-up, overdue)
- Pastor field mode: navigate, watch GPS only on the visit screen, confirm only inside the zone
- Exception / hospital / poor-GPS manual verification with admin approval
- Confidential pastoral notes vs administrative records
- Church, pastor and organizational reports (CSV + print/PDF)
- Audit trail
- One Voice 27 mission hub, I AM scripture designs, and #AllThingsNew countdown

Technology supports the pastoral relationship. It does not replace it. The app verifies a visit — it does not track pastors all day.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo sign-in (password `Mission2027!`)

| Role | Email |
| --- | --- |
| Master Administrator | master@onevoice27.org |
| Church Administrator | admin.harare@onevoice27.org |
| Pastor | pastor.tendai@onevoice27.org |

The demo flock is modelled on Harare (Zimbabwe East Conference / SID). Data is stored in the browser so the app works offline after first load. Use **Settings → Reset demo data** to start again.

## Firebase hosting & backend

This app is a Next.js 16 App Router project. Firebase project ID is already set to `onevoice27-f9270`.

1. In [Firebase Console](https://console.firebase.google.com/u/0/project/onevoice27-f9270/overview) enable **Authentication (Email/Password)**, **Cloud Firestore**, and **Hosting** (or **App Hosting**).
2. Create a Web App and copy keys into `.env.local` (see `.env.example`).
3. Install the Firebase CLI and log in:

```bash
npm install -g firebase-tools
firebase login
firebase experiments:enable webframeworks
firebase deploy
```

`firestore.rules` encodes the same roles as the UI. Deploy rules before inviting real churches.

## Geofencing

Member registration stores latitude, longitude and a radius (default 80 m, configurable per home). On **Go visit**, the pastor’s device GPS is watched. Confirm stays locked until the shepherd is inside the fence. A geofence entry alone never completes a visit — the pastor must choose a visit type and confirm.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- Firebase Hosting / App Hosting + Firestore rules for production
- Progressive web app manifest (install on pastors’ phones)

## Guiding verse

> I am the good shepherd: the good shepherd giveth his life for the sheep. — John 10:11
