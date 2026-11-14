import { createInterface } from "node:readline";
import { createTestApp } from "./harness.mjs";
const { mf, db } = await createTestApp({ port: 8787 });
console.log("LOCAL FIXTURES ONLY: http://localhost:8787 — no real emails, orders or payments.");
console.log(
  "Sign in with an @example.com test address. In this terminal: code email@example.com, then admin email@example.com after verifying.",
);
const input = createInterface({ input: process.stdin, output: process.stdout });
input.on("line", async (line) => {
  const [command, email] = line.trim().split(/\s+/);
  if (!email?.endsWith("@example.com")) return console.log("Use a test address at example.com.");
  if (command === "code") {
    const row = await db.prepare("SELECT code FROM test_outbox WHERE email=?").bind(email).first();
    console.log(row?.code ?? "No fixture code requested.");
  }
  if (command === "admin") {
    await db
      .prepare(
        "INSERT OR IGNORE INTO staff(user_id,role) SELECT id,'admin' FROM user WHERE email=? AND email_verified=1",
      )
      .bind(email)
      .run();
    console.log("Verified local test account promoted if it exists. Reload /admin.");
  }
});
async function close() {
  input.close();
  await mf.dispose();
  process.exit();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
