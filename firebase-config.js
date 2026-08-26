// ==========================================================================
// 1. Go to https://console.firebase.google.com -> Add project (free, no card needed)
// 2. In the project: Build -> Firestore Database -> Create database -> Start in TEST MODE
// 3. Project settings (gear icon) -> General -> "Your apps" -> Web app (</>) -> register it
// 4. Copy the config object it gives you and paste the values below
// ==========================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyClh7iiP2tjBsXeOH7hjZ9iyioWYpl9fDQ",
  authDomain: "class-test-2026.firebaseapp.com",
  projectId: "class-test-2026",
  storageBucket: "class-test-2026.firebasestorage.app",
  messagingSenderId: "241511277182",
  appId: "1:241511277182:web:f6802229bb0934fd27ae2f"
};

// Simple admin password to open admin.html. Change this before you deploy.
// NOTE: this is NOT real security — anyone who reads the page source can see it.
// It only keeps casual students out of the admin view. See README for the
// tighter option (Firestore rules) if you want real protection later.
export const ADMIN_PASSWORD = "change-me-1234";

// One shared password you announce to the class at test time. Students type
// their own roll number + name + this password to start — no roster to
// pre-load. Change this before you deploy.
export const STUDENT_PASSWORD = "test-2026";

// Piston (public, free code execution API) — no key needed.
export const PISTON_URL = "https://emkc.org/api/v2/piston";