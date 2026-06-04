import React from "react";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center", maxWidth: 380, width: "100%", padding: "0 24px" }}>
        <p style={{ fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
          Welcome to
        </p>
        <h1 style={{ fontSize: 40, color: "var(--forest)", marginBottom: 8 }}>Bookmarker</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 40, fontSize: 15 }}>
          A companion for in-person book clubs
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", padding: "13px 24px", fontSize: 15 }}
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}