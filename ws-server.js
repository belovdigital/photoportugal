const { WebSocketServer, WebSocket } = require("ws");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const fs = require("fs");

// Load env
const envFile = fs.readFileSync(".env", "utf8");
const env = Object.fromEntries(
  envFile.split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
  })
);

const PORT = parseInt(env.WS_PORT || "3002");
const JWT_SECRET = env.NEXTAUTH_SECRET;
if (!JWT_SECRET) throw new Error("NEXTAUTH_SECRET environment variable is required");
const DATABASE_URL = env.DATABASE_URL;

// DB pools
const pool = new Pool({ connectionString: DATABASE_URL });
const listenPool = new Pool({ connectionString: DATABASE_URL }); // dedicated for LISTEN

// Room management
const rooms = new Map(); // booking_id -> Set<{ ws, userId, userName }>
const socketMeta = new Map(); // ws -> { userId, userName, bookingId }

// User rooms for cross-screen real-time updates: when a booking
// changes status, new message arrives, payment lands, etc., we
// pg_notify('user_event', { user_id, event, data }) and broadcast to
// every WS connection belonging to that user. Clients then invalidate
// their React Query caches so dashboards update without a refresh.
const userRooms = new Map(); // userId -> Set<WebSocket>

function joinUserRoom(userId, ws) {
  if (!userRooms.has(userId)) userRooms.set(userId, new Set());
  userRooms.get(userId).add(ws);
}
function leaveUserRoom(userId, ws) {
  const set = userRooms.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userRooms.delete(userId);
}
function broadcastToUser(userId, payload) {
  const set = userRooms.get(userId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// Auth: verify JWT token
function verifyAuth(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.id) return { id: decoded.id, name: decoded.name || "", email: decoded.email || "" };
    return null;
  } catch { return null; }
}

// Verify user belongs to booking
async function verifyBookingAccess(userId, bookingId) {
  const result = await pool.query(
    `SELECT b.client_id, u.id as photographer_user_id
     FROM bookings b
     JOIN photographer_profiles pp ON pp.id = b.photographer_id
     JOIN users u ON u.id = pp.user_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (result.rows.length === 0) return false;
  const row = result.rows[0];
  return row.client_id === userId || row.photographer_user_id === userId;
}

// Broadcast to room
function broadcastToRoom(bookingId, data, excludeWs) {
  const room = rooms.get(bookingId);
  if (!room) return;
  const payload = JSON.stringify(data);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Online presence — global, not chat-scoped. The OTHER participant
// of a booking is "online" whenever they have ANY WebSocket connection
// open (i.e., they're authed and the app is foregrounded). This is
// closer to what users intuitively expect: "online" means "currently
// using the site / app", not "currently has the chat with me open".
//
// We still surface the result through the existing `online` event in
// the chat room so the client UI doesn't have to change.
async function getOnlineUsers(bookingId) {
  // Find both parties of the booking via DB.
  const result = await pool.query(
    `SELECT cu.id as client_id, cu.name as client_name,
            pu.id as photographer_user_id, pu.name as photographer_name
       FROM bookings b
       JOIN users cu ON cu.id = b.client_id
       JOIN photographer_profiles pp ON pp.id = b.photographer_id
       JOIN users pu ON pu.id = pp.user_id
      WHERE b.id = $1`,
    [bookingId]
  );
  if (result.rows.length === 0) return [];
  const { client_id, client_name, photographer_user_id, photographer_name } = result.rows[0];
  const online = [];
  if (userRooms.has(client_id)) online.push({ userId: client_id, userName: client_name });
  if (userRooms.has(photographer_user_id)) online.push({ userId: photographer_user_id, userName: photographer_name });
  return online;
}

// WSS
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  // Auth from query param ?token=xxx
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get("token");

  if (!token) {
    ws.close(4001, "Auth required");
    return;
  }

  const user = verifyAuth(token);
  if (!user) {
    ws.close(4001, "Invalid token");
    return;
  }

  console.log(`[ws] Connected: ${user.name || user.id}`);

  // Auto-join the user's own user-room so cross-screen events reach
  // them without an explicit join from the client. Mobile/web only
  // need to handle the "user_event" type as it arrives.
  const wasOffline = !userRooms.has(user.id);
  joinUserRoom(user.id, ws);

  // If this is the user's FIRST WS connection (i.e., they just came
  // online from fully offline), broadcast presence to every active
  // chat room where they're a participant so the other party's chat
  // UI flips them to online without needing to rejoin.
  if (wasOffline) {
    pool.query(
      `SELECT b.id
         FROM bookings b
         JOIN photographer_profiles pp ON pp.id = b.photographer_id
        WHERE b.client_id = $1 OR pp.user_id = $1`,
      [user.id]
    ).then(async (res) => {
      for (const { id: bookingId } of res.rows) {
        if (!rooms.has(bookingId)) continue;
        const onlineList = await getOnlineUsers(bookingId);
        broadcastToRoom(bookingId, { type: "online", users: onlineList });
      }
    }).catch((err) => {
      console.error("[ws] presence broadcast on connect failed:", err.message);
    });
  }

  // Handle messages from client
  ws.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "join" && data.booking_id) {
        // Leave previous room
        const prev = socketMeta.get(ws);
        if (prev) {
          const prevRoom = rooms.get(prev.bookingId);
          if (prevRoom) {
            for (const c of prevRoom) {
              if (c.ws === ws) { prevRoom.delete(c); break; }
            }
            if (prevRoom.size === 0) rooms.delete(prev.bookingId);
            else {
              const onlineList = await getOnlineUsers(prev.bookingId);
              broadcastToRoom(prev.bookingId, { type: "online", users: onlineList });
            }
          }
        }

        // Verify access
        const hasAccess = await verifyBookingAccess(user.id, data.booking_id);
        if (!hasAccess) {
          ws.send(JSON.stringify({ type: "error", message: "Access denied" }));
          return;
        }

        // Join room
        if (!rooms.has(data.booking_id)) rooms.set(data.booking_id, new Set());
        const client = { ws, userId: user.id, userName: user.name };
        rooms.get(data.booking_id).add(client);
        socketMeta.set(ws, { userId: user.id, userName: user.name, bookingId: data.booking_id });

        // Broadcast online status — global presence (anyone signed in)
        const onlineList = await getOnlineUsers(data.booking_id);
        broadcastToRoom(data.booking_id, { type: "online", users: onlineList });
        // Send current online to joiner
        ws.send(JSON.stringify({ type: "online", users: onlineList }));
        ws.send(JSON.stringify({ type: "joined", booking_id: data.booking_id }));
      }

      if (data.type === "typing") {
        const meta = socketMeta.get(ws);
        if (meta) {
          broadcastToRoom(meta.bookingId, {
            type: "typing",
            user_id: user.id,
            user_name: user.name,
          }, ws);
        }
      }

      if (data.type === "read") {
        const meta = socketMeta.get(ws);
        if (meta) {
          // Update read_at in DB
          await pool.query(
            "UPDATE messages SET read_at = NOW() WHERE booking_id = $1 AND sender_id != $2 AND read_at IS NULL",
            [meta.bookingId, user.id]
          );
          broadcastToRoom(meta.bookingId, {
            type: "read",
            user_id: user.id,
            timestamp: new Date().toISOString(),
          }, ws);
        }
      }
    } catch (err) {
      console.error("[ws] message error:", err.message);
    }
  });

  // Cleanup on disconnect
  ws.on("close", async () => {
    leaveUserRoom(user.id, ws);
    const meta = socketMeta.get(ws);
    if (meta) {
      const room = rooms.get(meta.bookingId);
      if (room) {
        for (const c of room) {
          if (c.ws === ws) { room.delete(c); break; }
        }
        if (room.size === 0) rooms.delete(meta.bookingId);
        else {
          const onlineList = await getOnlineUsers(meta.bookingId);
          broadcastToRoom(meta.bookingId, { type: "online", users: onlineList });
        }
      }
      socketMeta.delete(ws);
    }

    // If this was the user's LAST WebSocket connection, they've gone
    // fully offline — notify every active chat room where they're a
    // participant so the other party's UI reflects the change.
    if (!userRooms.has(user.id)) {
      try {
        const res = await pool.query(
          `SELECT b.id
             FROM bookings b
             JOIN photographer_profiles pp ON pp.id = b.photographer_id
            WHERE b.client_id = $1 OR pp.user_id = $1`,
          [user.id]
        );
        for (const { id: bookingId } of res.rows) {
          if (!rooms.has(bookingId)) continue;
          const onlineList = await getOnlineUsers(bookingId);
          broadcastToRoom(bookingId, { type: "online", users: onlineList });
        }
      } catch (err) {
        console.error("[ws] presence broadcast on close failed:", err.message);
      }
    }
  });

  // Heartbeat
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

// Heartbeat interval
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(heartbeat));

// PostgreSQL LISTEN for new_message + user_event channels.
// new_message → broadcast to per-booking chat room (legacy chat sync).
// user_event → broadcast to per-user room (dashboard sync, list refresh).
// Both channels share one connection, both are wrapped in try/catch so
// a malformed payload on one doesn't kill the listener for the other.
async function startListener() {
  const client = await listenPool.connect();
  await client.query("LISTEN new_message");
  await client.query("LISTEN user_event");
  client.on("notification", (msg) => {
    try {
      const data = JSON.parse(msg.payload);
      if (msg.channel === "new_message") {
        const { booking_id, message } = data;
        broadcastToRoom(booking_id, { type: "message", message });
      } else if (msg.channel === "user_event") {
        // { user_id, event, data? }
        if (data.user_id) {
          broadcastToUser(data.user_id, {
            type: "user_event",
            event: data.event,
            data: data.data || null,
          });
        }
      }
    } catch (err) {
      console.error("[ws] notification parse error:", msg.channel, err.message);
    }
  });
  client.on("error", (err) => {
    console.error("[ws] pg listener error:", err.message);
    setTimeout(startListener, 3000);
  });
  console.log(`[ws] Listening on new_message + user_event`);
}

startListener();
console.log(`[ws] WebSocket server running on port ${PORT}`);
