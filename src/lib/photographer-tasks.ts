import { query } from "@/lib/db";

export type TaskType = "respond" | "propose_date" | "mark_done" | "upload_delivery";
export type TaskUrgency = "overdue" | "soon" | "normal";

export interface PhotographerTask {
  id: string;
  type: TaskType;
  clientName?: string;
  bookingId?: string;
  deadline?: string;
  urgency: TaskUrgency;
  href: string;
}

interface RespondRow {
  id: string;
  client_name: string;
  last_message_at: string;
}

interface FlexibleRow {
  id: string;
  client_name: string;
  flexible_date_from: string;
}

interface MarkDoneRow {
  id: string;
  client_name: string;
  shoot_date: string;
}

interface DeliveryRow {
  id: string;
  client_name: string;
  deadline: string;
  shoot_date: string;
}

const HOURS = (h: number) => h * 60 * 60 * 1000;
const DAYS = (d: number) => d * 24 * HOURS(1);

function urgencyFromDeadline(deadlineISO: string, buffer: { soon: number; overdue: number }): TaskUrgency {
  const deadline = new Date(deadlineISO).getTime();
  const now = Date.now();
  const delta = deadline - now;
  if (delta < buffer.overdue) return "overdue";
  if (delta < buffer.soon) return "soon";
  return "normal";
}

interface DismissedRow {
  task_key: string;
  state_snapshot: string | null;
}

export async function getPhotographerTasks(profileId: string, userId: string): Promise<PhotographerTask[]> {
  const [respond, flexible, markDone, deliveries, dismissedRows] = await Promise.all([
    // "Respond to client" — conversation-scoped via messages.client_id +
    // messages.photographer_id. Messages live independently of any
    // single booking row, so we look at the latest non-system message
    // per (client_id, photographer_id) pair, then attach the latest
    // active booking row as the deep-link target for the task card.
    query<RespondRow>(
      `WITH last_per_conv AS (
         SELECT DISTINCT ON (m.client_id)
           m.client_id,
           m.sender_id AS last_sender_id,
           m.created_at AS last_message_at
         FROM messages m
         WHERE m.photographer_id = $1
           AND m.client_id IS NOT NULL
           AND COALESCE(m.is_system, FALSE) = FALSE
         ORDER BY m.client_id, m.created_at DESC
       ),
       active_booking AS (
         SELECT DISTINCT ON (b.client_id)
           b.client_id,
           b.id AS booking_id
         FROM bookings b
         WHERE b.photographer_id = $1
           AND b.status NOT IN ('cancelled','delivered')
         ORDER BY b.client_id, b.created_at DESC
       )
       SELECT ab.booking_id AS id, u.name AS client_name,
              lpc.last_message_at::text AS last_message_at
         FROM last_per_conv lpc
         JOIN active_booking ab ON ab.client_id = lpc.client_id
         JOIN users u ON u.id = lpc.client_id
        WHERE lpc.last_sender_id <> $2
        ORDER BY lpc.last_message_at ASC LIMIT 10`,
      [profileId, userId]
    ),
    query<FlexibleRow>(
      `SELECT b.id, u.name AS client_name, b.flexible_date_from
       FROM bookings b JOIN users u ON u.id = b.client_id
       WHERE b.photographer_id = $1
         AND b.status IN ('pending', 'confirmed')
         AND b.shoot_date IS NULL
         AND b.flexible_date_from IS NOT NULL
         AND (b.proposed_date IS NULL OR b.proposed_by = 'client')
       ORDER BY b.flexible_date_from ASC LIMIT 10`,
      [profileId]
    ),
    query<MarkDoneRow>(
      `SELECT b.id, u.name AS client_name, b.shoot_date
       FROM bookings b JOIN users u ON u.id = b.client_id
       WHERE b.photographer_id = $1
         AND b.status = 'confirmed'
         AND b.shoot_date IS NOT NULL
         AND b.shoot_date < CURRENT_DATE
       ORDER BY b.shoot_date ASC LIMIT 10`,
      [profileId]
    ),
    query<DeliveryRow>(
      `SELECT b.id, u.name AS client_name, b.shoot_date,
              (b.shoot_date + (COALESCE(p.delivery_days, 7) || ' days')::interval)::date AS deadline
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       LEFT JOIN packages p ON p.id = b.package_id
       WHERE b.photographer_id = $1
         AND b.status = 'completed'
         AND b.delivery_accepted = FALSE
         AND NOT EXISTS (SELECT 1 FROM delivery_photos dp WHERE dp.booking_id = b.id)
       ORDER BY b.shoot_date ASC LIMIT 10`,
      [profileId]
    ),
    query<DismissedRow>(
      `SELECT task_key, state_snapshot
         FROM dismissed_photographer_tasks
        WHERE photographer_id = $1`,
      [profileId]
    ),
  ]);

  // Photographer-dismissed tasks. A dismissal is honored ONLY while
  // the underlying state hasn't changed since dismiss time — for a
  // "respond" task that's last_message_at, for "mark_done" that's
  // shoot_date, etc. We store the snapshot at dismiss time and
  // compare against the current deadline of the task; if newer
  // activity bumped the deadline, we treat the dismissal as stale and
  // surface the task again. Equality (or older snapshot) keeps it hidden.
  const dismissed = new Map<string, string | null>();
  for (const row of dismissedRows) dismissed.set(row.task_key, row.state_snapshot);
  function isDismissed(taskId: string, currentSnapshot: string): boolean {
    if (!dismissed.has(taskId)) return false;
    const snap = dismissed.get(taskId);
    if (!snap) return true; // dismissed without snapshot — always hidden
    return new Date(currentSnapshot).getTime() <= new Date(snap).getTime();
  }

  const tasks: PhotographerTask[] = [];

  for (const row of respond) {
    const id = `respond-${row.id}`;
    if (isDismissed(id, row.last_message_at)) continue;
    const ageMs = Date.now() - new Date(row.last_message_at).getTime();
    const urgency: TaskUrgency = ageMs > HOURS(24) ? "overdue" : ageMs > HOURS(6) ? "soon" : "normal";
    tasks.push({
      id,
      type: "respond",
      clientName: row.client_name,
      bookingId: row.id,
      deadline: row.last_message_at,
      urgency,
      href: `/dashboard/messages/${row.id}`,
    });
  }

  for (const row of flexible) {
    const id = `flex-${row.id}`;
    const deadlineISO = new Date(row.flexible_date_from).toISOString();
    if (isDismissed(id, deadlineISO)) continue;
    tasks.push({
      id,
      type: "propose_date",
      clientName: row.client_name,
      bookingId: row.id,
      deadline: deadlineISO,
      urgency: urgencyFromDeadline(row.flexible_date_from, { soon: DAYS(3), overdue: 0 }),
      href: `/dashboard/bookings#${row.id}`,
    });
  }

  for (const row of markDone) {
    const id = `done-${row.id}`;
    const deadlineISO = new Date(row.shoot_date).toISOString();
    if (isDismissed(id, deadlineISO)) continue;
    tasks.push({
      id,
      type: "mark_done",
      clientName: row.client_name,
      bookingId: row.id,
      deadline: deadlineISO,
      urgency: "overdue",
      href: `/dashboard/bookings#${row.id}`,
    });
  }

  for (const row of deliveries) {
    const id = `delivery-${row.id}`;
    const deadlineISO = new Date(row.deadline).toISOString();
    if (isDismissed(id, deadlineISO)) continue;
    tasks.push({
      id,
      type: "upload_delivery",
      clientName: row.client_name,
      bookingId: row.id,
      deadline: deadlineISO,
      urgency: urgencyFromDeadline(deadlineISO, { soon: DAYS(2), overdue: 0 }),
      href: `/dashboard/bookings/${row.id}/deliver`,
    });
  }

  const urgencyRank: Record<TaskUrgency, number> = { overdue: 0, soon: 1, normal: 2 };
  tasks.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);

  return tasks;
}
