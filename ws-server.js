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

// Get online users in room
function getOnlineUsers(bookingId) {
  const room = rooms.get(bookingId);
  if (!room) return [];
  return [...room].map(c => ({ userId: c.userId, userName: c.userName }));
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
            else broadcastToRoom(prev.bookingId, { type: "online", users: getOnlineUsers(prev.bookingId) });
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

        // Broadcast online status
        broadcastToRoom(data.booking_id, { type: "online", users: getOnlineUsers(data.booking_id) });
        // Send current online to joiner
        ws.send(JSON.stringify({ type: "online", users: getOnlineUsers(data.booking_id) }));
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
  ws.on("close", () => {
    const meta = socketMeta.get(ws);
    if (meta) {
      const room = rooms.get(meta.bookingId);
      if (room) {
        for (const c of room) {
          if (c.ws === ws) { room.delete(c); break; }
        }
        if (room.size === 0) rooms.delete(meta.bookingId);
        else broadcastToRoom(meta.bookingId, { type: "online", users: getOnlineUsers(meta.bookingId) });
      }
      socketMeta.delete(ws);
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

// PostgreSQL LISTEN for new messages
async function startListener() {
  const client = await listenPool.connect();
  await client.query("LISTEN new_message");
  client.on("notification", (msg) => {
    try {
      const data = JSON.parse(msg.payload);
      const { booking_id, message } = data;
      broadcastToRoom(booking_id, { type: "message", message });
    } catch (err) {
      console.error("[ws] notification parse error:", err.message);
    }
  });
  client.on("error", (err) => {
    console.error("[ws] pg listener error:", err.message);
    setTimeout(startListener, 3000);
  });
  console.log(`[ws] Listening for pg notifications`);
}

startListener();
console.log(`[ws] WebSocket server running on port ${PORT}`);
