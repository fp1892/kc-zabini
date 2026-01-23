// /assets/cat.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "/assets/firebase-config.js";

function $(id){ return document.getElementById(id); }

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function getSecurity(db){
  const ref = doc(db, "config", "security");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() || {}) : {};
}

export async function initCAT(){
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInAnonymously(auth);

  // collection name for CAT topics (change if you want)
  const topicsCol = collection(db, "catTopics");
  const topicsQ = query(topicsCol, orderBy("ts", "desc"));

  const listEl = $("topicsList");
  const adminToggle = $("adminToggle");
  const adminPanel = $("adminPanel");
  const addBtn = $("addTopic");
  const titleEl = $("topicTitle");
  const textEl = $("topicText");

  let isAdmin = false;

  function renderTopic(id, data){
    const wrap = document.createElement("div");
    wrap.className = "topic";
    wrap.innerHTML = `
      <h4>${escapeHtml(data.title || "")}</h4>
      <p>${escapeHtml(data.text || "")}</p>
      <div class="meta"></div>
    `;

    const meta = wrap.querySelector(".meta");

    if (isAdmin) {
      const del = document.createElement("button");
      del.className = "pill small";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        if (!confirm("Delete this topic?")) return;
        await deleteDoc(doc(db, "catTopics", id));
      });
      meta.appendChild(del);
    }

    return wrap;
  }

  // Live updates
  onSnapshot(topicsQ, (snap) => {
    listEl.innerHTML = "";
    if (snap.empty) {
      const empty = document.createElement("div");
      empty.className = "topic";
      empty.innerHTML = `<h4>No topics yet</h4><p>Add the first entry via Admin.</p>`;
      listEl.appendChild(empty);
      return;
    }

    snap.forEach(d => {
      listEl.appendChild(renderTopic(d.id, d.data() || {}));
    });
  });

  // Admin unlock (adminHash)
  adminToggle.addEventListener("click", async () => {
    if (isAdmin) {
      // lock again
      isAdmin = false;
      sessionStorage.removeItem("catAdminUnlocked");
      adminPanel.style.display = "none";
      adminToggle.textContent = "Admin";
      // re-render list to hide delete buttons
      listEl.querySelectorAll(".topic").forEach(t => t.remove());
      // snapshot will repopulate; simplest is to let it refresh naturally
      location.reload();
      return;
    }

    const pw = prompt("Admin password:");
    if (!pw) return;

    try{
      const sec = await getSecurity(db);
      if (!sec.adminHash) return alert("adminHash missing in config/security");

      const enteredHash = await sha256Hex(pw);
      if (enteredHash !== sec.adminHash) return alert("Wrong admin password");

      isAdmin = true;
      sessionStorage.setItem("catAdminUnlocked","1");
      adminPanel.style.display = "block";
      adminToggle.textContent = "Admin ✓";
      // reload once so delete buttons render everywhere
      location.reload();
    } catch(e){
      console.error(e);
      alert("Admin check failed (see console)");
    }
  });

  // Keep admin state across reloads (same tab)
  if (sessionStorage.getItem("catAdminUnlocked") === "1") {
    isAdmin = true;
    adminPanel.style.display = "block";
    adminToggle.textContent = "Admin ✓";
  }

  // Add topic
  addBtn.addEventListener("click", async () => {
    if (!isAdmin) return alert("Admin required");

    const title = (titleEl.value || "").trim();
    const text = (textEl.value || "").trim();
    if (!title || !text) return alert("Please enter title and text.");

    await addDoc(topicsCol, { title, text, ts: Date.now() });

    titleEl.value = "";
    textEl.value = "";
  });
}

// small helper to avoid HTML injection
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}