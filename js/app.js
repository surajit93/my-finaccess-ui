/* =========================================================
   CONFIG
========================================================= */
const API_BASE = "https://my-finaccess.workers.dev";

/* =========================================================
   UTILITIES
========================================================= */
function qs(id) {
  return document.getElementById(id);
}

function setStatus(msg, type) {
  const el = qs("status");
  el.textContent = msg || "";
  el.className = "status " + (type || "");
}

/* =========================================================
   AUTH – OTP FLOW
========================================================= */
async function sendOTP() {
  const mobile = qs("mobile").value.trim();

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    setStatus("Enter valid 10-digit mobile.", "error");
    return;
  }

  qs("sendBtn").disabled = true;
  setStatus("Sending OTP…");

  const res = await fetch(`${API_BASE}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: mobile,
      purpose: "login_phone"
    })
  });

  if (!res.ok) {
    setStatus("OTP send failed.", "error");
    qs("sendBtn").disabled = false;
    return;
  }

  qs("step-mobile").style.display = "none";
  qs("step-otp").style.display = "block";
  setStatus("OTP sent.", "success");
}

async function verifyOTP() {
  const mobile = qs("mobile").value.trim();
  const otp = qs("otp").value.trim();

  qs("verifyBtn").disabled = true;
  setStatus("Verifying…");

  const res = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: mobile,
      otp,
      purpose: "login_phone"
    })
  });

  const data = await res.json();

  if (!data.token) {
    setStatus("Invalid OTP.", "error");
    qs("verifyBtn").disabled = false;
    return;
  }

  localStorage.setItem("auth_token", data.token);
  window.location.href = "./dashboard.html";
}


/* =========================================================
   NPA SEARCH
========================================================= */
async function searchNPA() {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  const state = qs("state").value.trim();
  const city = qs("city").value.trim();

  setStatus("Searching…");

  const res = await fetch(
    `${API_BASE}/npa/search?state=${state}&city=${city}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!res.ok) {
    setStatus("Search failed.", "error");
    return;
  }

  const data = await res.json();
  const box = qs("results");
  box.innerHTML = "";

  data.forEach(npa => {
    const div = document.createElement("div");
    div.style.marginTop = "14px";
    div.innerHTML = `
      <strong>${npa.product_type}</strong><br/>
      DPD: ${npa.dpd_days}<br/>
      Outstanding: ₹${npa.total_outstanding}<br/>
      <a href="./npa-view.html?id=${npa.id}">View</a>
    `;
    box.appendChild(div);
  });

  setStatus(`${data.length} results found`, "success");
}
/* =========================================================
   NPA VIEW / UNLOCK
========================================================= */
async function unlockContact() {
  const token = localStorage.getItem("auth_token");
  const params = new URLSearchParams(window.location.search);
  const npaId = params.get("id");

  setStatus("Unlocking…");

  const res = await fetch(`${API_BASE}/npa/${npaId}/unlock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      scope: "contact",
      price: 1,
      orgId: "APP_CONTEXT.orgId"
    })
  });

  if (!res.ok) {
    setStatus("Unlock failed.", "error");
    return;
  }

  setStatus("Unlocked successfully.", "success");
}

/* =========================================================
   AUTH GUARD & SESSION
========================================================= */
function requireAuth() {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    window.location.href = "./login.html";
    return null;
  }
  return token;
}

function logout() {
  localStorage.removeItem("auth_token");
  window.location.href = "./login.html";
}
/* =========================================================
   SUBSCRIPTIONS / CREDITS
========================================================= */
async function buyCredits(credits) {
  const token = requireAuth();
  if (!token) return;

  setStatus("Creating order…");

  const amount = credits * 100; // INR (example)

  const orderRes = await fetch(`${API_BASE}/subscriptions/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ amount })
  });

  if (!orderRes.ok) {
    setStatus("Order creation failed.", "error");
    return;
  }

  const order = await orderRes.json();

  // ⚠️ Placeholder: real Razorpay checkout later
  await capturePayment(order.id, credits);
}

async function capturePayment(orderId, credits) {
  const token = requireAuth();
  if (!token) return;

  setStatus("Finalizing payment…");

  const res = await fetch(`${API_BASE}/subscriptions/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      orderId,
      credits,
      orgId: "APP_CONTEXT.orgId"
    })
  });

  if (!res.ok) {
    setStatus("Payment failed.", "error");
    return;
  }

  setStatus("Credits added successfully.", "success");
}
/* =========================================================
   DOCUMENT UPLOAD
========================================================= */
async function uploadDocument() {
  const token = requireAuth();
  if (!token) return;

  const file = qs("docFile").files[0];
  const docType = qs("docType").value.trim();

  if (!file || !docType) {
    setStatus("Document type and file required.", "error");
    return;
  }

  const form = new FormData();
  form.append("file", file);
  form.append("docType", docType);

  setStatus("Uploading…");

  const res = await fetch(
    `${API_BASE}/documents/borrower/APP_CONTEXT.borrowerId/upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    }
  );

  if (!res.ok) {
    setStatus("Upload failed.", "error");
    return;
  }

  setStatus("Document uploaded successfully.", "success");
}
/* =========================================================
   CONSENT MANAGEMENT
========================================================= */
async function grantConsent() {
  const token = requireAuth();
  if (!token) return;

  const purpose = qs("consentPurpose").value.trim();
  if (!purpose) {
    setStatus("Consent purpose required.", "error");
    return;
  }

  setStatus("Granting consent…");

  const res = await fetch(
    `${API_BASE}/borrowers/APP_CONTEXT.borrowerId/consent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ purpose })
    }
  );

  if (!res.ok) {
    setStatus("Consent failed.", "error");
    return;
  }

  setStatus("Consent granted.", "success");
}
/* =========================================================
   ADMIN – ORG VERIFICATION
========================================================= */
async function verifyOrg() {
  const token = requireAuth();
  if (!token) return;

  const orgId = qs("orgId").value.trim();
  if (!orgId) {
    setStatus("Org ID required.", "error");
    return;
  }

  setStatus("Verifying org…");

  const res = await fetch(`${API_BASE}/admin/org/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ orgId })
  });

  if (!res.ok) {
    setStatus("Verification failed.", "error");
    return;
  }

  setStatus("Organisation verified.", "success");
}

/* =========================================================
   CONTEXT RESOLUTION (ORG / BORROWER)
========================================================= */
let APP_CONTEXT = {
  orgId: null,
  borrowerId: null
};

async function loadContext() {
  const token = requireAuth();
  if (!token) return;

  // 1️⃣ Fetch borrower profile (self)
  const borrowerRes = await fetch(`${API_BASE}/borrowers/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (borrowerRes.ok) {
    const borrower = await borrowerRes.json();
    APP_CONTEXT.borrowerId = borrower.id;
  }

  // 2️⃣ Fetch active org
  const orgRes = await fetch(`${API_BASE}/orgs/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (orgRes.ok) {
    const org = await orgRes.json();
    APP_CONTEXT.orgId = org.id;
  }
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */
async function loadAdminDashboard() {
  const token = requireAuth();
  if (!token) return;

  const box = qs("adminSummary");
  box.innerHTML = "Loading…";

  const res = await fetch(`${API_BASE}/admin/org/${APP_CONTEXT.orgId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    box.innerHTML = "Unable to load org data.";
    return;
  }

  const org = await res.json();

  box.innerHTML = `
    <strong>Org ID:</strong> ${org.id}<br/>
    <strong>Status:</strong> ${org.verified_status}<br/>
    <strong>Credits:</strong> ${org.credit_balance}<br/>
    <strong>Valid Till:</strong> ${org.valid_till}
  `;
}
