# 📚 Ebook Request — Setup Guide

## Files in this repository

| File | Description |
|------|-------------|
| `ebook-request-index.html` | Client request form (landing page) |
| `ebook-request-admin.html` | Admin dashboard |
| `ebook-request-payment.html` | Client payment & order confirmation page |
| `EbookRequest_AppScript.gs` | Google Apps Script backend |

---

## Step 1 — Set up Google Apps Script

1. Open your Google Spreadsheet:
   👉 https://docs.google.com/spreadsheets/d/13hbgb6mQadUxEhgPIywGI3__u_7gs_rLkbyjPb-aZZU

2. Click **Extensions → Apps Script**

3. Delete the default `myFunction()` code

4. Copy and paste the entire contents of **`EbookRequest_AppScript.gs`** into the editor

5. Click **Save** (floppy disk icon), name the project `EbookRequest`

6. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**

7. Copy the **Web App URL** — it looks like:
   `https://script.google.com/macros/s/XXXXXX/exec`

---

## Step 2 — Add the Script URL to your pages

### Option A — Via Admin Dashboard (easiest)
1. Open `ebook-request-admin.html`
2. Go to ⚙️ **Settings → Configuration**
3. Paste the Web App URL into **Apps Script Web App URL**
4. Click **💾 Save Configuration**

This saves the URL in your browser's localStorage — all three pages will use it automatically.

### Option B — Hardcode it (for GitHub Pages hosting)
In each HTML file, find the line:
```js
const SCRIPT_URL = localStorage.getItem('ebr_script_url') || '';
```
Replace with:
```js
const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

---

## Step 3 — Set up GitHub Pages

1. Go to your GitHub repo: https://github.com/ebookresearchhub/Ebookrequest
2. Click **Settings → Pages**
3. Source: **Deploy from a branch** → Branch: `main` → folder: `/ (root)`
4. Click **Save**
5. Your pages will be live at:
   - `https://ebookresearchhub.github.io/Ebookrequest/ebook-request-index.html`
   - `https://ebookresearchhub.github.io/Ebookrequest/ebook-request-admin.html`
   - `https://ebookresearchhub.github.io/Ebookrequest/ebook-request-payment.html`

---

## Step 4 — Set Payment Account Details

1. Open the Admin Dashboard
2. Go to ⚙️ **Settings → Payment Account Details**
3. Enter your **GCash**, **Maya**, and **Bank** details
4. Click **💾 Save Payment Details**

---

## Step 5 — Test

1. Run `testSetup()` in Apps Script editor to verify the Spreadsheet and Drive folder connections
2. Submit a test request on the landing page
3. Check your Google Sheet — a new row should appear under the **Requests** tab
4. Open the admin dashboard and view the request
5. Change status to **For Payment** and copy the payment link
6. Open the payment link and submit a test payment
7. Check the **Payments** tab in your spreadsheet

---

## Google Drive Folder
Attachments are saved here:
👉 https://drive.google.com/drive/folders/1ySwDnk5k8bLdnBTpop3aYYlqBXq4nZHI

Each request gets its own subfolder named by reference number (e.g. `EBR-250131-1042`).

---

## How the payment link works

1. Admin locates books → sets **Books Located Count** in detail modal
2. Admin changes status to **"For Payment"**
3. A unique link is auto-generated in the modal: `ebook-request-payment.html?ref=EBR-...&token=...&name=...`
4. Admin clicks **"📤 Copy FB Message"** → paste in Facebook Messenger to client
5. Client opens link → sees their order + amount → selects payment method → attaches proof → submits
6. Admin sees status update to **"Payment Submitted"** in dashboard
7. Admin verifies proof → changes status to **"Order Confirmed"** → sends the ebook

---

## Spreadsheet Structure

### Requests tab
`Reference No | Submitted At | Status | FB Full Name | Email | Facebook Link | Total Books Requested | Preferred Format | Accept Any Format | Books Requested | Books Count | Notes | Books Located Count | Admin Notes | Cover Files | Payment Confirmed | Last Updated`

### Payments tab
`Reference No | Submitted At | Payment Method | Sender Name | Total Paid | Message | Proof File URL | Status`
