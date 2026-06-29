import { resetPassword, routeForRole, signIn } from "../services/auth.service.js";

const loginForm = document.querySelector("[data-login-form]");
const resetForm = document.querySelector("[data-reset-form]");

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");

  try {
    const profile = await signIn(email, password);
    Swal.fire({ icon: "success", title: "Welcome", timer: 900, showConfirmButton: false });
    setTimeout(() => {
      window.location.href = routeForRole(profile.role);
    }, 900);
  } catch (error) {
    Swal.fire("Login failed", error.message, "error");
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = String(new FormData(resetForm).get("reset_email") || "").trim();
  try {
    await resetPassword(email);
    Swal.fire("Password reset sent", "Check the email inbox for the reset link.", "success");
    resetForm.reset();
  } catch (error) {
    Swal.fire("Reset failed", error.message, "error");
  }
});
