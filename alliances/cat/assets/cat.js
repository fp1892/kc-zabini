// /assets/cat.js (FINAL)

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

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

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
  // required DOM
  const required = ["topicsList","adminToggle","adminPanel","addTopic","topicTitle","topicText"];
  for (const id of required){
    if (!$(id)) {
      console.error("CAT missing element:", id);
      return;
    }
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInAnonymously(auth);

  const topicsCol = collection(db, "catTopics");
  const topicsQ = query(topicsCol, orderBy("ts", "desc"));

  const listEl = $("topicsList");
  const adminToggle = $("adminToggle");
  const adminPanel = $("adminPanel");
  const addBtn = $("addTopic");
  const titleEl = $("topicTitle");
  const textEl = $("topicText");

  const statusEl = $("topicStatus");
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg || ""; };

  // ✅ Admin state survives refresh (same tab)
  let isAdmin = sessionStorage.getItem("catAdminUnlocked") === "1";

  // We'll keep the latest docs so we can re-render when admin toggles
  let latestDocs = [];

  function applyAdminUI(){
    adminPanel.style.display = isAdmin ? "block" : "none";
    adminToggle.textContent = isAdmin ? "Admin ✓" : "Admin";
  }

  async function handleDelete(docId){
    if (!isAdmin) return;

    if (!confirm("Delete this topic?")) return;
    setStatus("Deleting…");
    try {
      await deleteDoc(doc(db, "catTopics", docId));
      setStatus("✅ Deleted");
      setTimeout(() => setStatus(""), 1200);
    } catch (e) {
      console.error(e);
      setStatus(`❌ Delete failed: ${e?.code || e?.message || "unknown"}`);
    }
  }

  function render(){
    listEl.innerHTML = "";

    if (!latestDocs.length) {
      const empty = document.createElement("div");
      empty.className = "topic";
      empty.innerHTML = `<h4>No topics yet</h4><p>Add the first entry via Admin.</p>`;
      listEl.appendChild(empty);
      return;
    }

    for (const d of latestDocs) {
      const data = d.data() || {};
      const wrap = document.createElement("div");
      wrap.className = "topic";

      wrap.innerHTML = `
        <h4>${escapeHtml(data.title || "")}</h4>
        <p>${escapeHtml(data.text || "")}</p>
        <div class="meta"></div>
      `;

      const meta = wrap.querySelector(".meta");

      // ✅ Always show delete button for admin (even after refresh)
      if (isAdmin) {
        const del = document.createElement("button");
        del.className = "pill small";
        del.type = "button";
        del.textContent = "Delete";
        del.addEventListener("click", () => handleDelete(d.id));
        meta.appendChild(del);
      }

      listEl.appendChild(wrap);
    }
  }

  // initial UI
  applyAdminUI();

  // Live updates
  onSnapshot(topicsQ, (snap) => {
    latestDocs = snap.docs;
    render();
  }, (err) => {
    console.error(err);
    setStatus(`❌ Load failed: ${err?.code || err?.message || "unknown"}`);
  });

  // Admin toggle (unlock/lock) – no reload needed
  adminToggle.addEventListener("click", async () => {
    if (isAdmin) {
      isAdmin = false;
      sessionStorage.removeItem("catAdminUnlocked");
      applyAdminUI();
      render();
      setStatus("Admin disabled");
      setTimeout(() => setStatus(""), 1200);
      return;
    }

    const pw = prompt("Admin password:");
    if (!pw) return;

    setStatus("Checking admin…");
    try {
      const sec = await getSecurity(db);
      if (!sec.adminHash) {
        setStatus("❌ adminHash missing in config/security");
        return;
      }

      const enteredHash = await sha256Hex(pw);
      if (enteredHash !== sec.adminHash) {
        setStatus("❌ Wrong admin password");
        return;
      }

      isAdmin = true;
      sessionStorage.setItem("catAdminUnlocked","1");
      applyAdminUI();
      render();
      setStatus("✅ Admin enabled");
      setTimeout(() => setStatus(""), 1200);
    } catch (e) {
      console.error(e);
      setStatus(`❌ Admin check failed: ${e?.code || e?.message || "unknown"}`);
    }
  });

  // Add topic
  addBtn.addEventListener("click", async () => {
    if (!isAdmin) {
      setStatus("❌ Admin required");
      return;
    }

    const title = (titleEl.value || "").trim();
    const text = (textEl.value || "").trim();
    if (!title || !text) {
      setStatus("❌ Please enter title and text");
      return;
    }

    setStatus("Adding…");
    try {
      await addDoc(topicsCol, { title, text, ts: Date.now() });
      titleEl.value = "";
      textEl.value = "";
      setStatus("✅ Added");
      setTimeout(() => setStatus(""), 1200);
    } catch (e) {
      console.error(e);
      setStatus(`❌ Add failed: ${e?.code || e?.message || "unknown"}`);
    }
  });
}