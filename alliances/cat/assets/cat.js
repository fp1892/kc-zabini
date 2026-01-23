// /assets/cat.js (LOUD DEBUG + Add/Delete)

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

function setStatus(msg){
  const el = $("topicStatus");
  if (el) el.textContent = msg || "";
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

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export async function initCAT(){
  // Basic DOM sanity check
  const required = ["topicsList","adminToggle","adminPanel","addTopic","topicTitle","topicText"];
  for (const id of required){
    if (!$(id)) {
      console.error("CAT missing element:", id);
      setStatus(`❌ Missing element: #${id}`);
      return;
    }
  }

  setStatus("CAT loaded ✓");

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error(e);
    setStatus("❌ signInAnonymously failed (rules/auth)");
    return;
  }

  const topicsCol = collection(db, "catTopics");
  const topicsQ = query(topicsCol, orderBy("ts", "desc"));

  const listEl = $("topicsList");
  const adminToggle = $("adminToggle");
  const adminPanel = $("adminPanel");

  const addBtn = $("addTopic");
  const titleEl = $("topicTitle");
  const textEl = $("topicText");

  let isAdmin = sessionStorage.getItem("catAdminUnlocked") === "1";

  function applyAdminUI(){
    adminPanel.style.display = isAdmin ? "block" : "none";
    adminToggle.textContent = isAdmin ? "Admin ✓" : "Admin";
  }
  applyAdminUI();

  // Live render
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
      const data = d.data() || {};
      const wrap = document.createElement("div");
      wrap.className = "topic";
      wrap.innerHTML = `
        <h4>${escapeHtml(data.title || "")}</h4>
        <p>${escapeHtml(data.text || "")}</p>
        <div class="meta"></div>
      `;

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
            setStatus(`❌ Delete failed: ${e?.code || e?.message || "unknown"}`);
          }
        });
        wrap.querySelector(".meta").appendChild(del);
      }

      listEl.appendChild(wrap);
    });
  }, (err) => {
    console.error(err);
    setStatus(`❌ onSnapshot failed: ${err?.code || err?.message || "unknown"}`);
  });

  // Admin unlock
  adminToggle.addEventListener("click", async () => {
    if (isAdmin) {
      isAdmin = false;
      sessionStorage.removeItem("catAdminUnlocked");
      applyAdminUI();
      setStatus("Admin disabled");
      return;
    }

    const pw = prompt("Admin password:");
    if (!pw) return;

    setStatus("Checking admin…");

    try{
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
      setStatus("✅ Admin enabled");
      setTimeout(() => setStatus(""), 1200);

    } catch(e){
      console.error(e);
      setStatus(`❌ Admin check failed: ${e?.code || e?.message || "unknown"}`);
    }
  });

  // ADD (this is the part you need)
  addBtn.addEventListener("click", async () => {
    setStatus("Add clicked ✓");

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