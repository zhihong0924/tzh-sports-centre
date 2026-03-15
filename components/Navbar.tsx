"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { UserMenu } from "@/components/UserMenu";
import { isAdmin } from "@/lib/admin";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";

const emptySubscribe = () => () => {};

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();
  const { data: session, status } = useSession();

  const userIsAdmin = isAdmin(session?.user?.email, session?.user?.isAdmin);
  const t = useTranslations("nav");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 outline-none focus:outline-none"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold text-sm">TZH</span>
              </div>
              <span className="text-base font-semibold text-foreground font-display hidden sm:block">
                TZH Sports Centre
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-0.5 xl:gap-1">
            <Link
              href="/booking"
              className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              🏸 {t("booking")}
            </Link>
            <Link
              href="/lessons"
              className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              📖 {t("lessons")}
            </Link>
            <Link
              href="/lessons/open"
              className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              🎓 {t("openLessons")}
            </Link>
            <Link
              href="/shop"
              className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              🛒 {t("shop")}
            </Link>
            {/* Videos section hidden - not complete yet
            <Link
              href="/videos"
              className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              🎬 {t("videos")}
            </Link>
            */}
            {session?.user?.isMember && (
              <Link
                href="/leaderboard"
                className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                🏆 {t("leaderboard")}
              </Link>
            )}
            {session?.user?.isTrainee && (
              <Link
                href="/training"
                className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                👤 {t("trainingSchedule")}
              </Link>
            )}
            {session?.user?.isTeacher && (
              <Link
                href="/teacher"
                className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                📋 {t("teacherDashboard")}
              </Link>
            )}
            {session?.user && (
              <Link
                href="/updates"
                className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                📢 {t("updates")}
              </Link>
            )}
            {userIsAdmin && (
              <Link
                href="/admin"
                className="px-2 xl:px-3 py-2 text-xs xl:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                ⚙️ {t("admin")}
              </Link>
            )}
          </div>

          {/* Auth Section */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <LanguageSwitcher />
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-card animate-pulse" />
            ) : session?.user ? (
              <UserMenu />
            ) : (
              <>
                <Link href="/auth/login">
                  <Button
                    variant="ghost"
                    className="text-sm text-muted-foreground hover:text-foreground hover:bg-white/10"
                  >
                    {t("login")}
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button className="text-sm bg-primary hover:bg-primary/90 text-white rounded-full px-4">
                    {t("signup")}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center gap-1">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-background border-t border-border">
          <div className="px-6 py-4 space-y-1">
            <Link
              href="/booking"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              🏸 {t("booking")}
            </Link>
            <Link
              href="/lessons"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              📖 {t("lessons")}
            </Link>
            <Link
              href="/lessons/open"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              🎓 {t("openLessons")}
            </Link>

            <Link
              href="/shop"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              🛒 {t("shop")}
            </Link>
            {/* Videos section hidden - not complete yet
            <Link
              href="/videos"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              🎬 {t("videos")}
            </Link>
            */}

            {session?.user?.isMember && (
              <Link
                href="/leaderboard"
                className="block py-2 text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                🏆 {t("leaderboard")}
              </Link>
            )}
            {session?.user?.isTrainee && (
              <Link
                href="/training"
                className="block py-2 text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                👤 {t("trainingSchedule")}
              </Link>
            )}
            {session?.user?.isTeacher && (
              <Link
                href="/teacher"
                className="block py-2 text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                📋 {t("teacherDashboard")}
              </Link>
            )}
            {session?.user && (
              <Link
                href="/updates"
                className="block py-2 text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                📢 {t("updates")}
              </Link>
            )}
            {userIsAdmin && (
              <Link
                href="/admin"
                className="block py-2 text-muted-foreground hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                ⚙️ {t("admin")}
              </Link>
            )}
            <hr className="my-3 border-border" />
            <div className="py-2 flex items-center gap-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Toggle theme"
              >
                {mounted && theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
              <LanguageSwitcher />
            </div>
            <hr className="my-3 border-border" />
            {session?.user ? (
              <>
                <div className="py-2 text-sm text-muted-foreground">
                  {session.user.name}
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="block py-2 text-red-600 hover:text-red-500"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="block py-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("login")}
                </Link>
                <Link
                  href="/auth/register"
                  className="block py-2 text-foreground font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("signup")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
