import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import {
  requireAuth,
  requireRole,
  CAN_EDIT_SETTINGS,
  CAN_BACKFILL,
  LEAD_ROLES,
  ROLES,
  hashDjangoPassword,
  generateTempPassword,
} from "../../_lib/auth.js";
import { resolveDateRange, inRange } from "../../_lib/dateRange.js";

// Merges routes/users/ticket-forms/puv-types into one
// function (Vercel Hobby's 12-function cap — see api/remote/auth/[action].js).
// All writable, all SUPERADMIN-only (CAN_EDIT_SETTINGS). Route is the only
// one with public read access; the rest require SUPERADMIN even to view.

// Archived rows are hidden from lists unless ?is_archived=true (mirrors
// ArchivableSettingMixin in backend/api/views/viewsets.py).
const wantsArchived = (req) => ["1", "true", "yes"].includes(String(req.query.is_archived ?? "false").toLowerCase());

// Rows referencing `id` per check ({ table, column, label }) — in-use items can
// only be archived, never deleted.
async function usageOf(supabase, id, checks) {
  const counts = await Promise.all(checks.map(async ({ table, column }) => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, id);
    if (error) throw error;
    return count || 0;
  }));
  return checks.map((c, i) => ({ ...c, count: counts[i] })).filter((c) => c.count);
}

async function rejectIfInUse(res, supabase, table, id, checks) {
  const used = await usageOf(supabase, id, checks);
  if (!used.length) return false;
  const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  const name = data?.origin ?? data?.name ?? "This item";
  res.status(409).json({ detail: `"${name}" is still used by ${used.map((u) => `${u.count} ${u.label}`).join(" and ")}. Archive it instead.` });
  return true;
}

const ROUTE_USAGE = [
  { table: "api_vehicle", column: "route_id", label: "vehicle(s)" },
  { table: "api_ticket", column: "route_id", label: "ticket(s)" },
];
const PUV_USAGE = [{ table: "api_vehicle", column: "transportation_id_id", label: "vehicle(s)" }];

async function routesResource(req, res, supabase, payload) {
  if (req.method === "GET") {
    const { rangeStart, rangeEnd } = resolveDateRange(req.query);
    const [{ data: routes, error: rErr }, { data: tickets, error: tErr }, { data: vehicles, error: vErr }] = await Promise.all([
      supabase.from("api_route").select("*").eq("is_archived", wantsArchived(req)).order("origin", { ascending: true }),
      supabase.from("api_ticket").select("route_id,vehicle_id,collection_amount,issued_at,dispatched_at"),
      supabase.from("api_vehicle").select("route_id"),
    ]);
    if (rErr) throw rErr;
    if (tErr) throw tErr;
    if (vErr) throw vErr;
    const shaped = routes.map((r) => {
      const routeTickets = (tickets || []).filter((t) => t.route_id === r.id && inRange(t.issued_at, rangeStart, rangeEnd));
      const revenueTickets = routeTickets.filter((t) => t.dispatched_at);
      return {
        id: r.id, origin: r.origin, is_active: r.is_active, is_archived: r.is_archived, created_at: r.created_at, updated_at: r.updated_at,
        estimated_loading_minutes: r.estimated_loading_minutes,
        vehicle_count: (vehicles || []).filter((v) => v.route_id === r.id).length,
        ticket_count: (tickets || []).filter((t) => t.route_id === r.id).length,
        full_name: r.origin,
        checked_in_today: new Set(routeTickets.map((t) => t.vehicle_id)).size,
        revenue_in_range: Math.round(revenueTickets.reduce((s, t) => s + (Number(t.collection_amount) || 0), 0) * 100) / 100,
      };
    });
    res.status(200).json(shaped);
    return;
  }

  requireRole(payload, CAN_EDIT_SETTINGS);

  if (req.method === "POST") {
    const { origin, is_active = true } = req.body || {};
    if (!origin || !origin.trim()) return void res.status(400).json({ detail: "origin is required" });
    // created_at/updated_at are Django's auto_now_add/auto_now — application-managed,
    // not DB defaults, so both columns are NOT NULL with nothing to fall back on here.
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("api_route")
      .insert({ origin: origin.trim(), is_active, created_at: now, updated_at: now })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
    return;
  }
  if (req.method === "PATCH" || req.method === "PUT") {
    const id = req.query.id;
    if (!id) return void res.status(400).json({ detail: "id query param is required" });
    const { origin, is_active, is_archived } = req.body || {};
    const updates = {};
    if (origin !== undefined) updates.origin = origin;
    if (is_active !== undefined) updates.is_active = is_active;
    if (is_archived !== undefined) updates.is_archived = is_archived;
    const { data, error } = await supabase.from("api_route").update(updates).eq("id", id).select().single();
    if (error) throw error;
    res.status(200).json(data);
    return;
  }
  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return void res.status(400).json({ detail: "id query param is required" });
    if (await rejectIfInUse(res, supabase, "api_route", id, ROUTE_USAGE)) return;
    const { error } = await supabase.from("api_route").delete().eq("id", id);
    if (error) throw error;
    res.status(204).end();
    return;
  }
  res.status(405).json({ detail: "Method not allowed" });
}

async function usersResource(req, res, supabase, payload) {
  // Admin-only, except Supervisor/Manager may list staff and tick a Personnel's fleet
  // access (a PATCH carrying only can_manage_fleet) — mirrors UserViewSet.fleet_access.
  const isAdmin = CAN_EDIT_SETTINGS.includes(payload.role);
  const SELECT = "id, username, first_name, middle_name, last_name, role, is_active, must_reset_password, email_verified, can_manage_fleet";
  if (!isAdmin) {
    const body = req.body || {};
    const fleetTickOnly = (req.method === "PATCH" || req.method === "PUT")
      && Object.keys(body).length === 1 && body.can_manage_fleet !== undefined;
    if (!(req.method === "GET" || fleetTickOnly)) requireRole(payload, CAN_EDIT_SETTINGS);
    requireRole(payload, LEAD_ROLES);
    if (fleetTickOnly) {
      const id = req.query.id;
      if (!id) return void res.status(400).json({ detail: "id query param is required" });
      const { data: target, error: tErr } = await supabase.from("api_user").select("role").eq("id", id).single();
      if (tErr) throw tErr;
      if (target.role !== ROLES.PERSONNEL) return void res.status(403).json({ detail: "Fleet access only applies to Personnel accounts." });
    }
  }

  if (req.method === "GET") {
    let query = supabase.from("api_user").select(SELECT).order("username", { ascending: true });
    if (!isAdmin) query = query.eq("role", ROLES.PERSONNEL); // leads only see Personnel
    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json(data);
    return;
  }
  if (req.method === "POST") {
    const { username, first_name = "", middle_name = "", last_name = "", role = "PERSONNEL", is_active = true, can_manage_fleet = false } = req.body || {};
    if (!username || !username.trim()) return void res.status(400).json({ detail: "username (email) is required" });
    const tempPassword = generateTempPassword();
    // created_at/updated_at (auto_now_add/auto_now) and date_joined (AbstractUser's
    // default=timezone.now) are all Django application-side defaults, not DB
    // defaults — the column is NOT NULL with nothing to fall back on if omitted.
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("api_user")
      .insert({
        username: username.trim(), first_name, middle_name, last_name, role, is_active, can_manage_fleet,
        password: hashDjangoPassword(tempPassword), must_reset_password: true, is_staff: false, is_superuser: false,
        created_at: now, updated_at: now, date_joined: now,
      })
      .select(SELECT).single();
    if (error) throw error;
    res.status(201).json({ ...data, generated_password: tempPassword });
    return;
  }
  if (req.method === "PATCH" || req.method === "PUT") {
    const id = req.query.id;
    if (!id) return void res.status(400).json({ detail: "id query param is required" });
    // Allowlisted, not spread from req.body — a client sending an extra `password`
    // or `is_superuser` field must never reach the update untouched.
    const EDITABLE_USER_FIELDS = ["username", "first_name", "middle_name", "last_name", "role", "is_active", "can_manage_fleet"];
    const body = req.body || {};
    const updates = {};
    for (const f of EDITABLE_USER_FIELDS) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (updates.role !== undefined || updates.is_active !== undefined) {
      const { data: target, error: tErr } = await supabase.from("api_user").select("id, role, is_active").eq("id", id).single();
      if (tErr) throw tErr;
      const msg = await accountChangeBlocker(supabase, payload, target, updates.role ?? target.role, updates.is_active ?? target.is_active);
      if (msg) return void res.status(400).json({ detail: msg });
    }
    if (body.new_password) {
      updates.password = hashDjangoPassword(body.new_password);
      updates.must_reset_password = true;
    }
    const { data, error } = await supabase.from("api_user").update(updates).eq("id", id).select(SELECT).single();
    if (error) throw error;
    res.status(200).json(data);
    return;
  }
  if (req.method === "DELETE") {
    // Accounts are never deleted (it would orphan their history) — deactivate instead.
    return void res.status(400).json({ detail: "Staff accounts cannot be deleted. Deactivate the account instead." });
  }
  res.status(405).json({ detail: "Method not allowed" });
}

// Mirror of UserViewSet._guard_account_change in backend/api/views/viewsets.py.
async function accountChangeBlocker(supabase, payload, target, role, isActive) {
  if (String(target.id) === String(payload.sub) && (!isActive || role !== target.role)) {
    return "You cannot deactivate or change the role of your own account.";
  }
  if (target.role === "SUPERADMIN" && target.is_active && (!isActive || role !== "SUPERADMIN")) {
    const { count } = await supabase.from("api_user").select("id", { count: "exact", head: true })
      .eq("role", "SUPERADMIN").eq("is_active", true).neq("id", target.id);
    if (!count) return "This is the last active Admin. Promote or create another Admin first.";
  }
  return null;
}

// `usage` makes the table archivable: lists hide archived rows, PATCH accepts
// is_archived, and DELETE is refused while other rows still reference it.
function simpleCrud(table, { createFields, requiredField = "name", usage }) {
  const editableFields = usage ? [...createFields, "is_archived"] : createFields;
  return async (req, res, supabase, payload) => {
    // SUPERADMIN-only for every method, reads included — see the file-level comment.
    requireRole(payload, CAN_EDIT_SETTINGS);

    if (req.method === "GET") {
      let query = supabase.from(table).select("*").order(requiredField, { ascending: true });
      if (usage) query = query.eq("is_archived", wantsArchived(req));
      const { data, error } = await query;
      if (error) throw error;
      if (usage) {
        const { data: refs, error: refErr } = await supabase.from(usage[0].table).select(usage[0].column);
        if (refErr) throw refErr;
        for (const row of data) row.vehicle_count = refs.filter((v) => v[usage[0].column] === row.id).length;
      }
      res.status(200).json(data);
      return;
    }

    if (req.method === "POST") {
      const body = req.body || {};
      if (!body[requiredField] || !String(body[requiredField]).trim()) {
        res.status(400).json({ detail: `${requiredField} is required` });
        return;
      }
      const insert = Object.fromEntries(createFields.map((f) => [f, body[f]]));
      const { data, error } = await supabase.from(table).insert(insert).select().single();
      if (error) throw error;
      res.status(201).json(data);
      return;
    }
    if (req.method === "PATCH" || req.method === "PUT") {
      const id = req.query.id;
      if (!id) return void res.status(400).json({ detail: "id query param is required" });
      const body = req.body || {};
      const updates = Object.fromEntries(editableFields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
      const { data, error } = await supabase.from(table).update(updates).eq("id", id).select().single();
      if (error) throw error;
      res.status(200).json(data);
      return;
    }
    if (req.method === "DELETE") {
      const id = req.query.id;
      if (!id) return void res.status(400).json({ detail: "id query param is required" });
      if (usage && (await rejectIfInUse(res, supabase, table, id, usage))) return;
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      res.status(204).end();
      return;
    }
    res.status(405).json({ detail: "Method not allowed" });
  };
}

async function wipModeResource(req, res, supabase) {
  // Read-only remotely by design — see WipMode's docstring in
  // backend/api/models.py. Anyone authenticated can check it (it just gates
  // whether the backfill form below is usable), no role check needed.
  if (req.method !== "GET") {
    res.status(405).json({ detail: "Method not allowed" });
    return;
  }
  const { data, error } = await supabase.from("api_wipmode").select("is_active,updated_at").eq("id", 1).maybeSingle();
  if (error) throw error;
  res.status(200).json(data || { is_active: false, updated_at: null });
}

// Keys match F_PLATE etc. in backend/api/views/backfill.py and
// src/app/dashboard/settings/backfill/fields.js — same required set as
// backfill.py's _resolve_batch (minus Ticket Type/Quantity's own value checks,
// which need a DB lookup only the LAN side can do), checked here only so a
// malformed remote submission fails fast instead of silently sitting PENDING
// until the LAN's next sync cycle rejects it. "Ticket Number" is Single
// Entry's advanced exact-number fallback — optional here, since the normal
// path never sends one.
const BACKFILL_REQUIRED = ["Vehicle Plate Number", "Ticket Type", "Date and Time Issued", "Notes"];

async function backfillResource(req, res, supabase, payload) {
  requireRole(payload, CAN_BACKFILL);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("api_remotebackfillrequest")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.status(200).json(data);
    return;
  }

  if (req.method === "POST") {
    const { data: wip, error: wipErr } = await supabase.from("api_wipmode").select("is_active").eq("id", 1).maybeSingle();
    if (wipErr) throw wipErr;
    if (!wip?.is_active) {
      res.status(409).json({ detail: "Switch the LAN terminal to WIP mode before backfilling remotely." });
      return;
    }

    // The backfill screen sends a whole batch ({ rows: [...] }) as ONE request, which the
    // LAN applies all-or-nothing as a single history entry. A bare row (older clients)
    // is still accepted as a batch of one.
    const body = req.body || {};
    const batchRows = Array.isArray(body.rows) ? body.rows : null;
    const row = batchRows ? {} : body;
    const ticketId = String(row["Ticket Number"] || "").trim();
    const missing = [];
    for (const r of batchRows || [row]) {
      const rowTicketId = String(r["Ticket Number"] || "").trim();
      for (const f of BACKFILL_REQUIRED) if (!String(r[f] || "").trim() && !missing.includes(f)) missing.push(f);
      // Ticket Amount is only required for the normal auto-consume path — the advanced
      // exact-ticket-number fallback (Ticket Number present) doesn't use it. A batch leaves it
      // blank: the LAN fills each trip to the vehicle type's terminal price.
      if (!batchRows && !rowTicketId && !String(r["Ticket Amount"] || "").trim() && !missing.includes("Ticket Amount")) missing.push("Ticket Amount");
    }
    if (batchRows && batchRows.length === 0) missing.push("rows");
    if (missing.length) {
      res.status(400).json({ detail: `Missing required field(s): ${missing.join(", ")}` });
      return;
    }

    // Dedup only applies to the exact-ticket-number fallback — the normal path has no
    // natural key to dedup on (a retried submission just queues a second batch, same
    // small risk a double-tap on live ticket dispatch already carries).
    if (ticketId) {
      // A retried POST (flaky connection, double tab, back-button resubmit) must not
      // queue a second request for the same ticket — the LAN sync worker would apply
      // one and permanently fail the other with a confusing "already exists" error.
      const { data: dup, error: dupErr } = await supabase
        .from("api_remotebackfillrequest")
        .select("id,status")
        .eq("ticket_id", ticketId)
        .in("status", ["PENDING", "APPLIED"])
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (dup) {
        res.status(409).json({
          detail: dup.status === "APPLIED"
            ? `Ticket ${ticketId} has already been backfilled.`
            : `Ticket ${ticketId} was already submitted and is still pending.`,
        });
        return;
      }
    }

    // created_at is Django's auto_now_add — application-managed, not a DB default,
    // so the column is NOT NULL with nothing to fall back on if omitted here.
    const { data, error } = await supabase
      .from("api_remotebackfillrequest")
      .insert({
        payload: batchRows ? { rows: batchRows } : row,
        ticket_id: ticketId,
        requested_by_name: payload.username || "",
        status: "PENDING",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    // Normalized to look like backfill.py's {outcome, ...} response so the
    // frontend's existing success-check (result.outcome === "ok") still
    // works without a remote-specific branch there — see useTicketBackfill.
    res.status(201).json({ outcome: "ok", queued: true, ticket_id: data.ticket_id, status: data.status, id: data.id });
    return;
  }

  res.status(405).json({ detail: "Method not allowed" });
}

const RESOURCES = {
  routes: routesResource,
  users: usersResource,
  "ticket-forms": simpleCrud("api_ticketform", { createFields: ["name", "price"], requiredField: "name" }),
  "puv-types": simpleCrud("api_puvtype", { createFields: ["name", "terminal_price"], requiredField: "name", usage: PUV_USAGE }),
  "wip-mode": wipModeResource,
  backfill: backfillResource,
};

export default async function handler(req, res) {
  let payload;
  try {
    payload = requireAuth(req);
  } catch (err) {
    res.status(err.status || 401).json({ detail: err.message || "Not authenticated" });
    return;
  }

  const run = RESOURCES[req.query.resource];
  if (!run) {
    res.status(404).json({ detail: `Unknown settings resource: ${req.query.resource}` });
    return;
  }

  try {
    await run(req, res, supabaseAdmin(), payload);
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ detail: err.message });
      return;
    }
    console.error(`remote/settings/${req.query.resource} error:`, err);
    res.status(500).json({ detail: "Request failed" });
  }
}
