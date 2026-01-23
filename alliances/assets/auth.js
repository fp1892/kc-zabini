// assets/auth.js
const PASSWORD_HASH = "CHANGE_ME_HASH"; // exakt der gleiche Hash wie im Wiki

function sha256(str) {
  const buf = new TextEncoder().encode(str);
  return crypto.subtle.digest("SHA-256", buf).then(hash =>
    Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function initAuth() {
  const form = document.getElementById("loginForm");
  const input = document.getElementById("passwordInput");
  const status = document.getElementById("loginStatus");
  const overlay = document.getElementById("loginOverlay");
  const root = document.getElementById("protectedRoot");

  form.addEventListener("submit", async e => {
    e.preventDefault();
    status.textContent = "Checking…";

    const hash = await sha256(input.value);
    if (hash === PASSWORD_HASH) {
      overlay.style.display = "none";
      root.style.display = "block";
      sessionStorage.setItem("zabini-auth", "ok");
    } else {
      status.textContent = "Invalid password";
    }
  });

  if (sessionStorage.getItem("zabini-auth") === "ok") {
    overlay.style.display = "none";
    root.style.display = "block";
  }
}