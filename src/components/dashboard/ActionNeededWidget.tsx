import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PhotographerTask, TaskUrgency } from "@/lib/photographer-tasks";

const URGENCY_STYLE: Record<TaskUrgency, { dot: string; pill: string; pillText: string }> = {
  overdue: { dot: "bg-red-500", pill: "bg-red-50", pillText: "text-red-700" },
  soon: { dot: "bg-amber-500", pill: "bg-amber-50", pillText: "text-amber-800" },
  normal: { dot: "bg-accent-500", pill: "bg-accent-50", pillText: "text-accent-800" },
};

function formatDeadline(deadlineISO: string, locale: string): string {
  const d = new Date(deadlineISO);
  const now = Date.now();
  const delta = d.getTime() - now;
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const lang = locale === "pt" ? "pt-PT" : "en-GB";
  const relative = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });

  if (Math.abs(delta) < dayMs) {
    const hrs = Math.round(delta / hourMs);
    return relative.format(hrs, "hour");
  }
  const days = Math.round(delta / dayMs);
  if (Math.abs(days) <= 14) return relative.format(days, "day");
  return d.toLocaleDateString(lang, { day: "numeric", month: "short" });
}

export async function ActionNeededWidget({
  tasks,
  locale,
}: {
  tasks: PhotographerTask[];
  locale: string;
}) {
  if (tasks.length === 0) return null;
  const t = await getTranslations("dashboard.actionNeeded");

  return (
    <div className="rounded-2xl border border-warm-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{t("title")}</h2>
        <span className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
          {tasks.length}
        </span>
      </div>

      <ul className="mt-4 divide-y divide-warm-100">
        {tasks.map((task) => {
          const style = URGENCY_STYLE[task.urgency];
          return (
            <li key={task.id} className="py-3 first:pt-0 last:pb-0">
              <Link href={task.href} className="group flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700">
                    {t(`${task.type}.title`, { name: task.clientName || "" })}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t(`${task.type}.subtitle`)}
                  </p>
                </div>
                {task.deadline && (
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.pill} ${style.pillText}`}>
                    {formatDeadline(task.deadline, locale)}
                  </span>
                )}
                <svg className="mt-1 h-4 w-4 shrink-0 text-gray-300 group-hover:text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
