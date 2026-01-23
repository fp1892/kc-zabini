// /assets/auth.js
const PASSWORD_HASH = "CHANGE_ME_HASH"; // <-- exakt der Hash, den du fürs Wiki nutzt

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function initAuth() {
  const overlay = document.getElementById("loginOverlay");
  const form = document.getElementById("loginForm");
  const input = document.getElementById("passwordInput");
  const status = document.getElementById("loginStatus");
  const root = document.getElementById("protectedRoot");

  if (sessionStorage.getItem("zabini-auth") === "ok") {
    overlay.style.display = "none";
    root.style.display = "block";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Checking…";

    const hash = await sha256(input.value);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem("zabini-auth", "ok");
      overlay.style.display = "none";
      root.style.display = "block";
    } else {
      status.textContent = "Invalid password";
    }
  });
}