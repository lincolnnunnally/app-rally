import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Calendar,
  GraduationCap,
  House,
  MapPin,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RallyWordmark } from "@/components/brand";
import { UserButton } from "@/lib/auth/gates";
import { noticeLessonId } from "@/lib/lesson-status";
import { listNotices, markNoticesRead } from "@/lib/rally-server";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Today", icon: House },
  { to: "/app/play", label: "Play", icon: Calendar },
  { to: "/app/courts", label: "Courts", icon: MapPin },
  { to: "/app/coaches", label: "Coaches", icon: GraduationCap },
  { to: "/app/you", label: "You", icon: UserRound },
] as const;

const NOTICE_HREFS = [
  "/app",
  "/app/desk",
  "/app/coaches",
  "/app/courts",
  "/app/play",
  "/app/partners",
  "/app/leagues",
  "/app/mental",
  "/app/progress",
] as const;

type NoticeHref = (typeof NOTICE_HREFS)[number];

function asNoticeHref(href: string | null): NoticeHref {
  if (href && (NOTICE_HREFS as readonly string[]).includes(href)) return href as NoticeHref;
  return "/app";
}

function isActive(pathname: string, to: string) {
  if (to === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-5 py-3 backdrop-blur md:px-6">
        <RallyWordmark />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-10 items-center rounded-md px-3 text-sm transition-colors duration-150",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <NoticeBell />
          <div className="hidden md:block">
            <UserButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col pb-24 md:pb-10">
        <Outlet />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] tracking-wide",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NoticeBell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const notices = useQuery({ queryKey: ["notices"], queryFn: () => listNotices() });
  const unread = (notices.data ?? []).filter((n) => !n.read).length;
  const mark = useMutation({
    mutationFn: () => markNoticesRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notices"] });
      void qc.invalidateQueries({ queryKey: ["home"] });
    },
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label="Notices"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0) mark.mutate();
        }}
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Notices</p>
          {(notices.data ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Quiet. Lesson confirms and court holds land here.</p>
          ) : (
            <ul className="mt-3 flex max-h-80 flex-col gap-3 overflow-y-auto">
              {(notices.data ?? []).map((n) => {
                const lessonId = noticeLessonId(n.href);
                return (
                  <li key={n.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                    {lessonId ? (
                      <Link
                        to="/app/lessons/$id"
                        params={{ id: lessonId }}
                        className="block"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-sm">{n.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                      </Link>
                    ) : (
                      <Link
                        to={asNoticeHref(n.href)}
                        className="block"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-sm">{n.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
