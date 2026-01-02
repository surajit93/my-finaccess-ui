/* =========================================================
   GLOBAL CONFIG
   ========================================================= */

const API_BASE = ""; // same-origin (Cloudflare Pages + Workers)
const SESSION_KEY = "finaccess_session";
const ROLE_KEY = "finaccess_role";

/* =========================================================
   SESSION HELPERS
   ========================================================= */

function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(sessionId, role) {
  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(ROLE_KEY, role);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
}

function authHeaders(extra = {}) {
  const token = getSession();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/* =========================================================
   AUTH FLOW
   ========================================================= */

async function sendOTP() {
  const mobile = document.getElementById("mobile")?.value;
  if (!mobile) return alert("Mobile required");

  const r = await fetch(`${API_BASE}/auth/otp/request`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mobile }),
  });

  if (!r.ok) return alert("OTP request failed");
  alert("OTP sent");
}

async function verifyOTP() {
  const mobile = document.getElementById("mobile")?.value;
  const otp = document.getElementById("otp")?.value;
  if (!mobile || !otp) return alert("Invalid input");

  const r = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mobile, otp }),
  });

  if (!r.ok) return alert("OTP invalid");

  const data = await r.json();

  // TEMP: role inference (replace with backend role lookup later)
  const role = mobile.startsWith("9") ? "borrower" : "lender_user";

  setSession(data.session_id, role);

  routePostLogin(role);
}

async function logout() {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  });
  clearSession();
  window.location.href = "/login.html";
}

/* =========================================================
   ROUTING
   ========================================================= */

function routePostLogin(role) {
  if (role === "borrower") {
    window.location.href = "/app/borrower.html";
  } else if (role === "lender_user") {
    window.location.href = "/app/lender.html";
  } else if (role === "admin") {
    window.location.href = "/app/admin.html";
  } else {
    alert("Unknown role");
  }
}

function enforceAuth(expectedRole = null) {
  const session = getSession();
  const role = localStorage.getItem(ROLE_KEY);

  if (!session) {
    window.location.href = "/login.html";
    return;
  }

  if (expectedRole && role !== expectedRole) {
    alert("Unauthorized");
    logout();
  }
}

/* =========================================================
   BORROWER FUNCTIONS
   ========================================================= */

async function submitLoan() {
  enforceAuth("borrower");

  const payload = {
    user_id: "self", // backend maps session → user
    loan_type: document.getElementById("loanType")?.value || "personal",
    requested_amount: Number(document.getElementById("loanAmount")?.value),
    tenure_months: Number(document.getElementById("loanTenure")?.value),
    monthly_income: Number(document.getElementById("income")?.value),
    existing_emis: Number(document.getElementById("emis")?.value || 0),
  };

  const r = await fetch(`${API_BASE}/loan-applications`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const res = await r.json();
  if (!r.ok) return alert("Eligibility check failed");

  const el = document.getElementById("result");
  if (!el) return;

  el.classList.remove("hidden");
  el.innerHTML = `
    <h3>Eligibility Result</h3>
    <p><b>Eligible:</b> ${res.eligible}</p>
    <p><b>Score:</b> ${res.eligibility_score}</p>
    <p><b>Risk:</b> ${res.risk_band}</p>
    ${
      res.blockers?.length
        ? `<p><b>Blockers:</b> ${res.blockers
            .map(b => b.message)
            .join(", ")}</p>`
        : ""
    }
  `;
}

/* =========================================================
   LENDER FUNCTIONS
   ========================================================= */

async function loadLenderApplications() {
  enforceAuth("lender_user");

  const r = await fetch(`${API_BASE}/lender/loan-applications`, {
    headers: authHeaders(),
  });

  const list = await r.json();
  if (!r.ok) return alert("Failed to load applications");

  const tbody = document.getElementById("apps");
  if (!tbody) return;

  tbody.innerHTML = list
    .map(
      a => `
    <tr>
      <td>${a.full_name}</td>
      <td>₹${a.requested_amount}</td>
      <td>${a.risk_band}</td>
      <td>${a.application_stage}</td>
    </tr>
  `
    )
    .join("");
}

/* =========================================================
   ADMIN / OPS
   ========================================================= */

async function loadMetrics() {
  enforceAuth("admin");

  const r = await fetch(`${API_BASE}/ops/metrics`, {
    headers: authHeaders(),
  });

  const data = await r.json();
  document.getElementById("metrics").textContent =
    JSON.stringify(data, null, 2);
}

/* =========================================================
   AUTO INIT PER PAGE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;

  if (path.includes("/borrower")) {
    enforceAuth("borrower");
  }

  if (path.includes("/lender")) {
    enforceAuth("lender_user");
    loadLenderApplications();
  }

  if (path.includes("/admin")) {
    enforceAuth("admin");
    loadMetrics();
  }
});
