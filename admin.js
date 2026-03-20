import { loginAdmin, watchAuth, getUserProfile } from "./auth.js";

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const msgEl = document.getElementById("msg");

loginBtn.addEventListener("click", async () => {
  try {
    msgEl.textContent = "Entrando...";
    const cred = await loginAdmin(emailEl.value.trim(), passwordEl.value);
    const profile = await getUserProfile(cred.user.uid);

    if (!profile) {
      msgEl.textContent = "Usuário sem perfil no painel.";
      return;
    }

    localStorage.setItem("sa_user_profile", JSON.stringify(profile));
    location.href = "./dashboard.html";
  } catch (error) {
    msgEl.textContent = "Erro ao entrar: " + error.message;
  }
});

watchAuth(async (user) => {
  if (!user) return;
  const profile = await getUserProfile(user.uid);
  if (profile) {
    localStorage.setItem("sa_user_profile", JSON.stringify(profile));
  }
});