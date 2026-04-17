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

export async function getPhotographerTasks(profileId: string, userId: string): Promise<PhotographerTask[]> {
  const [respond, flexible, markDone, deliveries] = await Promise.all([
    query<RespondRow>(
      `SELECT b.id, u.name AS client_name, last_msg.created_at AS last_message_at
       FROM bookings b
       JOIN users u ON u.id = b.client_id
       JOIN LATERAL (
         SELECT sender_id, created_at
         FROM messages m
         WHERE m.booking_id = b.id
         ORDER BY created_at DESC
         LIMIT 1
       ) last_msg ON true
       WHERE b.photographer_id = $1
         AND last_msg.sender_id <> $2
         AND b.status NOT IN ('cancelled', 'delivered')
       ORDER BY last_msg.created_at ASC LIMIT 10`,
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
  ]);

  const tasks: PhotographerTask[] = [];

  for (const row of respond) {
    const ageMs = Date.now() - new Date(row.last_message_at).getTime();
    const urgency: TaskUrgency = ageMs > HOURS(24) ? "overdue" : ageMs > HOURS(6) ? "soon" : "normal";
    tasks.push({
      id: `respond-${row.id}`,
      type: "respond",
      clientName: row.client_name,
      bookingId: row.id,
      deadline: row.last_message_at,
      urgency,
      href: `/dashboard/messages?chat=${row.id}`,
    });
  }

  for (const row of flexible) {
    tasks.push({
      id: `flex-${row.id}`,
      type: "propose_date",
      clientName: row.client_name,
      bookingId: row.id,
      deadline: new Date(row.flexible_date_from).toISOString(),
      urgency: urgencyFromDeadline(row.flexible_date_from, { soon: DAYS(3), overdue: 0 }),
      href: `/dashboard/bookings#${row.id}`,
    });
  }

  for (const row of markDone) {
    tasks.push({
      id: `done-${row.id}`,
      type: "mark_done",
      clientName: row.client_name,
      bookingId: row.id,
      deadline: new Date(row.shoot_date).toISOString(),
      urgency: "overdue",
      href: `/dashboard/bookings#${row.id}`,
    });
  }

  for (const row of deliveries) {
    const deadlineISO = new Date(row.deadline).toISOString();
    tasks.push({
      id: `delivery-${row.id}`,
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
