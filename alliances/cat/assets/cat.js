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

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export async function initCAT(){
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInAnonymously(auth);

  // Collection for topics
  const topicsCol = collection(db, "catTopics");
  const topicsQ = query(topicsCol, orderBy("ts", "desc"));

  const listEl = $("topicsList");
  const adminToggle = $("adminToggle");
  const adminPanel = $("adminPanel");
  const statusEl = $("topicStatus");

  const addBtn = $("addTopic");
  const titleEl = $("topicTitle");
  const textEl = $("topicText");

  let isAdmin = sessionStorage.getItem("catAdminUnlocked") === "1";

  function setStatus(msg){
    if (!statusEl) return;
    statusEl.textContent = msg || "";
  }

  function renderAllTopics(docs){
    listEl.innerHTML = "";

    if (!docs.length) {
      const empty = document.createElement("div");
      empty.className = "topic";
      empty.innerHTML = `<h4>No topics yet</h4><p>Add the first entry via Admin.</p>`;
      listEl.appendChild(empty);
      return;
    }

    for (const d of docs) {
      const data = d.data() || {};
      const wrap = document.createElement("div");
      wrap.className = "topic";
      wrap.innerHTML = `
        <h4>${escapeHtml(data.title || "")}</h4>
        <p>${escapeHtml(data.text || "")}</p>
        <div class="meta"></div>
      `;

      const meta = wrap.querySelector(".meta");

      // ✅ Delete button only visible for admin
      if (isAdmin) {
        const del = document.createElement("button");
        del.className = "pill small";
        del.type = "button";
        del.textContent = "Delete";
        del.addEventListener("click", async () => {
          if (!confirm("Delete this topic?")) return;
          setStatus("Deleting…");
          try {
            await deleteDoc(doc(db, "catTopics", d.id));
            setStatus("✅ Deleted");
            setTimeout(() => setStatus(""), 1200);
          } catch (e) {
            console.error(e);
            setStatus("❌ Delete failed (check Firestore rules / console)");
          }
        });
        meta.appendChild(del);
      }

      listEl.appendChild(wrap);
    }
  }

  // Live updates
  let lastDocs = [];
  onSnapshot(topicsQ, (snap) => {
    lastDocs = snap.docs;
    renderAllTopics(lastDocs);
  });

  // Apply admin state to UI
  function applyAdminUI(){
    if (isAdmin) {
      adminPanel.style.display = "block";
      adminToggle.textContent = "Admin ✓";
    } else {
      adminPanel.style.display = "none";
      adminToggle.textContent = "Admin";
      setStatus("");
    }
    // re-render to show/hide delete buttons
    renderAllTopics(lastDocs);
  }

  applyAdminUI();

  // Admin unlock using adminHash
  adminToggle.addEventListener("click", async () => {
    if (isAdmin) {
      // lock again
      isAdmin = false;
      sessionStorage.removeItem("catAdminUnlocked");
      applyAdminUI();
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
      sessionStorage.setItem("catAdminUnlocked", "1");
      setStatus("✅ Admin enabled");
      setTimeout(() => setStatus(""), 1200);
      applyAdminUI();
    } catch (e) {
      console.error(e);
      setStatus("❌ Admin check failed (see console)");
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
      setStatus("❌ Add failed (check Firestore rules / console)");
    }
  });
}