import {
  doc, getDoc, setDoc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";

// 🔧 Change if your old data lived under another doc id (e.g. "hellcats")
const STATE_DOC_ID = "main";

export const refs = {
  state: doc(db, "state", STATE_DOC_ID),
  undo: doc(db, "state", `${STATE_DOC_ID}_undo`),
  security: doc(db, "config", "security"),
};

export async function ensureStateDoc() {
  const snap = await getDoc(refs.state);
  if (!snap.exists()) {
    await setDoc(refs.state, { persons: [], events: [], mvpCooldown: 1 });
  }
}

export async function loadSecurity() {
  const snap = await getDoc(refs.security);
  return snap.exists() ? snap.data() : null;
}

export function subscribeState(onData, onOnline, onError) {
  return onSnapshot(
    refs.state,
    snap => {
      const d = snap.data() || {};
      onData({
        persons: d.persons || [],
        events: d.events || [],
        mvpCooldown: d.mvpCooldown ?? 1,
      });
      onOnline?.();
    },
    err => {
      console.error(err);
      onError?.(err);
    }
  );
}

export async function saveState(state) {
  await updateDoc(refs.state, {
    persons: state.persons,
    events: state.events,
    mvpCooldown: state.mvpCooldown,
  });
}

export async function writeUndoSnapshot(label) {
  const snap = await getDoc(refs.state);
  await setDoc(refs.undo, {
    meta: { label, at: new Date().toISOString() },
    state: snap.data()
  });
}

export async function restoreUndo() {
  const snap = await getDoc(refs.undo);
  if (!snap.exists()) return null;
  return snap.data().state;
}

export async function overwriteState(newState) {
  await setDoc(refs.state, newState);
}