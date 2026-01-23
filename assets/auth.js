// /assets/auth.js
// Standard password gate using Firestore: config/security.passwordHash
// Requires anonymous sign-in so Firestore rules can allow read for auth'd users.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "/assets/firebase-config.js";

function $(id) { return document.getElementById(id); }

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSecurityDoc(db) {
  const securityRef = doc(db, "config", "security");
  const snap = await getDoc(securityRef);
  return snap.exists() ? (snap.data() || {}) : {};
}

function showProtected() {
  $("loginOverlay").style.display = "none";
  $("protectedRoot").style.display = "block";
}

function setStatus(msg) {
  $("loginStatus").textContent = msg || "";
}

/**
 * initAuth({
 *   sessionKey: "kcUnlocked", // optional
 * })
 */
export async function initAuth(opts = {}) {
  const sessionKey = opts.sessionKey || "kcUnlocked";

  // Already unlocked in this tab/session for this subdomain
  if (sessionStorage.getItem(sessionKey) === "1") {
    showProtected();
    return;
  }

  setStatus("Connecting…");

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Ensure we have an auth'd context for Firestore rules
    await signInAnonymously(auth);

    setStatus("Please enter the password.");

    $("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus("Checking…");

      try {
        const sec = await getSecurityDoc(db);
        const passwordHash = sec.passwordHash;

        if (!passwordHash) {
          setStatus("❌ passwordHash missing in config/security");
          return;
        }

        const entered = $("passwordInput").value || "";
        const enteredHash = await sha256Hex(entered);

        if (enteredHash !== passwordHash) {
          setStatus("❌ Wrong password");
          return;
        }

        sessionStorage.setItem(sessionKey, "1");
        setStatus("✅ OK");
        showProtected();
      } catch (err) {
        console.error(err);
        setStatus("❌ Error (see console)");
      }
    });
  } catch (e) {
    console.error(e);
    setStatus("❌ Firebase connection failed (see console).");
  }
}