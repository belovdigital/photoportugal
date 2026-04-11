"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { trackSignUp } from "@/lib/analytics";

function SignUpForm() {
  const router = useRouter();
  const t = useTranslations("auth.signUp");
  const tc = useTranslations("common");
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "photographer" ? "photographer" : "client";
  const [role, setRole] = useState<"client" | "photographer">(initialRole);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignUp() {
    const redirectAfter = searchParams.get("callbackUrl") || "/dashboard";
    signIn("google", {
      callbackUrl: `/api/auth/set-role?role=${role}&redirect=${encodeURIComponent(redirectAfter)}`,
    });
  }

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 8 ? 2 : /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password) ? 4 : 3;
  const strengthLabel = ["", t("passwordStrength.tooShort"), t("passwordStrength.weak"), t("passwordStrength.good"), t("passwordStrength.strong")][passwordStrength];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"][passwordStrength];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("errors.passwordMinLength"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName, last_name: lastName, email, password, role,
          utm_source: typeof window !== "undefined" ? sessionStorage.getItem("utm_source") : null,
          utm_medium: typeof window !== "undefined" ? sessionStorage.getItem("utm_medium") : null,
          utm_campaign: typeof window !== "undefined" ? sessionStorage.getItem("utm_campaign") : null,
          utm_term: typeof window !== "undefined" ? sessionStorage.getItem("utm_term") : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errors.somethingWentWrong"));
        setLoading(false);
        return;
      }

      trackSignUp("credentials", role);

      if (role === "client" && data.autoLogin) {
        // Auto-login for clients (no email verification needed)
        const signInRes = await signIn("credentials", {
          email: email.trim(),
          password,
          redirect: false,
        });
        if (signInRes?.ok) {
          const redirectTo = searchParams.get("callbackUrl") || "/dashboard";
          window.location.href = redirectTo;
          return;
        }
      }

      // Photographers: redirect to sign-in with verification message
      router.push("/auth/signin?verify=pending");
    } catch {
      setError(t("errors.somethingWentWrong"));
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            {t("title")}
          </h1>
          <p className="mt-2 text-gray-500">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-warm-200 bg-white p-8 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Role selector */}
          <div className="mb-6">
            <div className="relative flex rounded-xl bg-warm-100 p-1">
              {/* Sliding pill */}
              <div
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-all duration-200 ease-out"
                style={{ left: role === "client" ? "4px" : "calc(50% + 0px)" }}
              />
              <button
                type="button"
                onClick={() => setRole("client")}
                className={`relative z-10 flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  role === "client" ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {t("roleClient")}
              </button>
              <button
                type="button"
                onClick={() => setRole("photographer")}
                className={`relative z-10 flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  role === "photographer" ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {t("rolePhotographer")}
              </button>
            </div>
          </div>

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignUp}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t("signUpWithGoogle")}
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-warm-200" />
            <span className="text-sm text-gray-400">{t("orWithEmail")}</span>
            <div className="h-px flex-1 bg-warm-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  {t("firstNameLabel")}
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder={t("firstNamePlaceholder")}
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  {t("lastNameLabel")}
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder={t("lastNamePlaceholder")}
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t("emailLabel")}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                placeholder={t("emailPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t("passwordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 pr-11 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder={t("passwordPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div key={level} className={`h-1 flex-1 rounded-full ${level <= passwordStrength ? strengthColor : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <span className={`text-xs ${passwordStrength >= 3 ? "text-green-600" : passwordStrength >= 2 ? "text-yellow-600" : "text-red-600"}`}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? t("creatingAccount") : t("createAccount")}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400">
            {t("agreeToTerms")}{" "}
            <Link href="/terms" className="text-primary-600 hover:underline">{tc("terms")}</Link>{" "}
            {tc("and")}{" "}
            <Link href="/privacy" className="text-primary-600 hover:underline">{tc("privacyPolicy")}</Link>
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          {t("alreadyHaveAccount")}{" "}
          <Link href={`/auth/signin${searchParams.get("callbackUrl") ? `?callbackUrl=${encodeURIComponent(searchParams.get("callbackUrl")!)}` : ""}`} className="font-semibold text-primary-600 hover:text-primary-700">
            {tc("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
