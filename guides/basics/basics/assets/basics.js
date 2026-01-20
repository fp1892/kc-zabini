console.log("EVENT SITE", "v1");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAjWpYMV0xKUVqD2MdhmHdsv-CONgZ8iDM",
  authDomain: "zabini-mvp.firebaseapp.com",
  projectId: "zabini-mvp",
  storageBucket: "zabini-mvp.firebasestorage.app",
  messagingSenderId: "757946103220",
  appId: "1:757946103220:web:d56c1371db8c84aac7eee1"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

const securityRef = doc(db, "config", "security");

function $(id){ return document.getElementById(id); }

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function checkPasswordGate(pass){
  const snap = await getDoc(securityRef);
  const sec = snap.data() || {};
  if (!sec.passwordHash) return false;
  const hash = await sha256Hex(pass);
  return hash === sec.passwordHash;
}

function showProtected(){
  $("loginOverlay").style.display = "none";
  $("protectedRoot").style.display = "block";
}

function setStatus(msg){ $("loginStatus").textContent = msg; }

async function bootstrap(){
  // If user already unlocked in this tab, skip
  if (sessionStorage.getItem("eventUnlocked") === "1") {
    showProtected();
    return;
  }

  setStatus("Connecting…");
  try {
    await signInAnonymously(auth);
    setStatus("Please enter the password.");
  } catch (e) {
    console.error(e);
    setStatus("❌ Firebase connection failed (see console).");
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("Checking…");

    try {
      const ok = await checkPasswordGate($("passwordInput").value || "");
      if (!ok) return setStatus("❌ Wrong password");

      sessionStorage.setItem("eventUnlocked", "1");
      setStatus("✅ OK");
      showProtected();
    } catch (err) {
      console.error(err);
      setStatus("❌ Error (see console)");
    }
  });
}

bootstrap();