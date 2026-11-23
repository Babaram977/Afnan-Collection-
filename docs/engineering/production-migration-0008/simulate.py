"""Offline dry run of migrate-production-0008.yml: runs the workflow's own SQL and Node
verification scripts against SQLite copies of the acceptance schema with representative data,
for every starting state and for the stop conditions. Emulates Wrangler's ledger and JSON output."""
import json, os, re, sqlite3, subprocess, sys, shutil, yaml

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT = os.environ.get("SIM_OUT", "/tmp/production-migration-0008-sim")
wf = yaml.safe_load(open(f"{REPO}/.github/workflows/migrate-production-0008.yml"))
run = [s for s in wf["jobs"]["migrate"]["steps"] if s.get("name", "").startswith("Verify identity")][0]["run"]
SQL = re.search(r'^SQL="(.*)"$', run, re.M).group(1)
EXTRA = re.search(r'--command "\$SQL (.*?)" > after.json', run).group(1).replace('\\"', '"')
SCRIPTS = re.findall(r"node --input-type=module <<'JS'\n(.*?)\n\s*JS\n", run, re.S)
BEFORE_JS, AFTER_JS = SCRIPTS[1], SCRIPTS[2]
MIG = sorted(os.listdir(f"{REPO}/migrations"))

def fill(db, table, **values):
    cols = db.execute(f"PRAGMA table_info({table})").fetchall()
    row = {}
    for _, name, typ, notnull, dflt, pk in cols:
        if name in values: row[name] = values[name]
        elif notnull and dflt is None: row[name] = 1 if "INT" in (typ or "").upper() else f"x-{name}"
    db.execute(f"INSERT INTO {table}({','.join(row)}) VALUES({','.join('?'*len(row))})", list(row.values()))

def build(upto):
    db = sqlite3.connect(":memory:"); db.row_factory = sqlite3.Row
    db.execute("CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, applied_at TEXT)")
    for f in MIG[:6]:
        db.executescript(open(f"{REPO}/migrations/{f}").read()); db.execute("INSERT INTO d1_migrations(name) VALUES(?)", (f,))
    # Representative acceptance-like data: owner account, categories, catalogue, zones, orders, evidence.
    fill(db, "user", id="u1", email="owner@example.com", name="Owner")
    fill(db, "account", id="a1", user_id="u1")
    fill(db, "session", id="s1", user_id="u1", token="t1")
    db.execute("INSERT INTO staff(user_id,role) VALUES('u1','admin')")
    for i in range(3): db.execute("INSERT OR IGNORE INTO categories(slug,label) VALUES(?,?)", (f"cat{i}", f"Cat {i}"))
    db.execute("INSERT INTO zones(id,name,state,fee_kobo,active) VALUES('z1','Kano Metropoli','Kano',150000,1)")
    db.execute("INSERT INTO products(id,slug,name,category,status) VALUES('p1','gown','Gown','cat0','active')")
    db.execute("INSERT INTO variants(id,product_id,sku,price_kobo,stock) VALUES('v1','p1','G-1',2000000,20),('v2','p1','G-2',1000000,5)")
    for oid, status in [("o1", "pending"), ("o2", "paid"), ("o3", "expired")]:
        db.execute("INSERT INTO orders(id,owner,idempotency_key,request_hash,email,customer,address,zone_id,delivery_kobo,total_kobo,status,expires_at,payment_method,reference) VALUES(?,?,?,?,?,'{}','{}','z1',150000,0,'pending',9999999999,'bank_transfer',?)",
                   (oid, f"guest:{oid}", f"k-{oid}", "h", f"{oid}@x", f"AC-{oid}"))
        db.execute("INSERT INTO order_items(order_id,variant_id,name,sku,price_kobo,qty) VALUES(?,'v1','Gown','G-1',2000000,2)", (oid,))
        db.execute("UPDATE orders SET total_kobo=4150000 WHERE id=?", (oid,))
    db.execute("INSERT INTO payment_receipts(id,order_id,object_key,content_type,bytes,sha256,submitted_at) VALUES('r1','o2','receipts/o2/r1.png','image/png',100,?,1)", ("a"*64,))
    db.execute("INSERT INTO bank_transfer_approvals(order_id,decision_id,amount_kobo,bank_reference,outcome,approved_by,approved_at) VALUES('o2','d1',4150000,'MP-001','paid','u1',1)")
    db.execute("UPDATE orders SET status='paid' WHERE id='o2'")
    db.execute("UPDATE orders SET status='expired' WHERE id='o3'")
    db.execute("INSERT INTO audit(actor,action,entity_id) VALUES('u1','order.created','o1')")
    for f in MIG[6:6 + upto]:
        db.executescript(open(f"{REPO}/migrations/{f}").read()); db.execute("INSERT INTO d1_migrations(name) VALUES(?)", (f,))
    return db

def execute(db, sql):
    out = []
    for st in [s for s in re.split(r";\s*", sql) if s.strip()]:
        out.append({"results": [dict(r) for r in db.execute(st).fetchall()], "success": True})
    return out

def pending(db):
    done = {r[0] for r in db.execute("SELECT name FROM d1_migrations")}
    todo = [m for m in MIG if m not in done]
    return "No migrations to apply!" if not todo else "Migrations to be applied:\n" + "\n".join(todo)

def apply(db):
    done = {r[0] for r in db.execute("SELECT name FROM d1_migrations")}
    for m in MIG:
        if m not in done:
            db.executescript(open(f"{REPO}/migrations/{m}").read()); db.execute("INSERT INTO d1_migrations(name) VALUES(?)", (m,))

def node(script, cwd):
    p = subprocess.run(["node", "--input-type=module"], input=script, text=True, cwd=cwd, capture_output=True,
                       env={**os.environ, "GITHUB_STEP_SUMMARY": f"{cwd}/summary.md", "RELEASE": "434cec4", "DATABASE": "73ddfc46"})
    lines = [l for l in p.stderr.splitlines() if "AssertionError" in l or "Error:" in l]
    return p.returncode, (lines[0] if lines else "")[:170]

def scenario(name, db, expect_before_ok=True, mutate_between=None, expect_after_ok=True):
    d = f"{OUT}/{name}"; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    open(f"{d}/recovery.json", "w").write('{"bookmark":"00000000-sim"}')
    open(f"{d}/pending-before.txt", "w").write(pending(db))
    try:
        json.dump(execute(db, SQL), open(f"{d}/before.json", "w"))
    except sqlite3.OperationalError as e:
        # wrangler d1 execute fails, and the step (bash -e) stops before any migration is applied.
        return print(f"{name}: before {'STOPPED as expected' if not expect_before_ok else 'FAILED unexpectedly'} -- snapshot query failed: {e}")
    rc, err = node(BEFORE_JS, d)
    if not expect_before_ok:
        return print(f"{name}: before {'STOPPED as expected' if rc else 'DID NOT STOP (BAD)'} -- {err}")
    if rc: return print(f"{name}: before FAILED unexpectedly -- {err}")
    state = open(f"{d}/start-state").read()
    if state != "both": apply(db)
    if mutate_between: db.execute(mutate_between)
    json.dump(execute(db, SQL + " " + EXTRA), open(f"{d}/after.json", "w"))
    rc, err = node(AFTER_JS, d)
    ok = (rc == 0) == expect_after_ok
    print(f"{name}: start={state} after={'PASS' if rc == 0 else 'FAIL'} ({'as expected' if ok else 'UNEXPECTED'}) {err if rc else ''}")

# Production already has 0007: build(1) is its shape, with a catalogue and orders in every state.
scenario("A-production-at-0007", build(1))
scenario("B-rerun-after-0008", build(2))
scenario("C-database-still-at-0006", build(0), expect_before_ok=False)
db = build(1); db.execute("CREATE TABLE admin_events(id TEXT PRIMARY KEY)")
scenario("D-partial-0008-table-no-ledger", db, expect_before_ok=False)
db = build(1); db.execute("ALTER TABLE payment_receipts ADD COLUMN transfer_reference TEXT")
scenario("E-partial-0008-column-no-ledger", db, expect_before_ok=False)
db = build(1); db.execute("INSERT INTO bank_transfer_approvals(order_id,decision_id,amount_kobo,bank_reference,outcome,approved_by,approved_at) VALUES('o3','d2',4150000,' mp-001 ','late_review','u1',1)")
scenario("F-duplicate-bank-reference", db, expect_before_ok=False)
scenario("G-stock-changed-detected", build(1), mutate_between="UPDATE variants SET stock=stock-1 WHERE id='v1'", expect_after_ok=False)
scenario("H-pickup-flag-changed-detected", build(1), mutate_between="UPDATE orders SET fulfilment_method='pickup' WHERE id='o1'", expect_after_ok=False)
scenario("I-selection-changed-detected", build(1), mutate_between="UPDATE order_items SET selections='[]' WHERE order_id='o1'", expect_after_ok=False)
print(open(f"{OUT}/A-production-at-0007/summary.md").read())
