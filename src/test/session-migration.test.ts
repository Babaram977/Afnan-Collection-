import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function legacyDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const file of [
    "0001_commerce.sql",
    "0002_admin_management.sql",
    "0003_administrator_mfa.sql",
    "0004_bank_transfer_reservation.sql",
    "0005_payment_receipts.sql",
  ])
    db.exec(readFileSync(`migrations/${file}`, "utf8"));
  db.exec(`INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('fixture-owner','Fixture','owner@example.test',1,1,1);
    INSERT INTO account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES('fixture-account','fixture-owner','credential','fixture-owner','fixture-hash-unchanged',1,1);
    INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES('fixture-session','fixture-token-not-a-credential','fixture-owner',9999999999999,1,1);
    INSERT OR IGNORE INTO categories(slug,label) VALUES('migration-fixture','Fixture');
    INSERT INTO products(id,slug,name,category) VALUES('fixture-product','migration-fixture','Fixture','migration-fixture');
    INSERT INTO variants(id,product_id,sku,price_kobo,stock) VALUES('fixture-variant','fixture-product','MIGRATION-FIXTURE',250000,5);`);
  return db;
}
const migration = () => readFileSync("migrations/0006_session_authentication_method.sql", "utf8");
describe("session authentication migration", () => {
  it("tags existing sessions as legacy without altering accounts or merchandise", () => {
    const db = legacyDatabase();
    try {
      const account = db.prepare("SELECT * FROM account").all();
      const stock = db.prepare("SELECT * FROM variants").all();
      const products = db.prepare("SELECT * FROM products").all();
      db.exec(migration());
      expect(db.prepare("SELECT auth_method FROM session").get()?.["auth_method"]).toBe("legacy");
      expect(db.prepare("SELECT * FROM account").all()).toEqual(account);
      expect(db.prepare("SELECT * FROM variants").all()).toEqual(stock);
      expect(db.prepare("SELECT * FROM products").all()).toEqual(products);
      expect(db.prepare("PRAGMA quick_check").get()?.["quick_check"]).toBe("ok");
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
  it("supports old-code inserts and constrains new method values", () => {
    const db = legacyDatabase();
    try {
      db.exec(migration());
      db.exec(
        "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES('old-code','old-code-fixture','fixture-owner',9999999999999,1,1)",
      );
      expect(
        db.prepare("SELECT auth_method FROM session WHERE id='old-code'").get()?.["auth_method"],
      ).toBe("legacy");
      expect(() => db.exec("UPDATE session SET auth_method='unverified-client-value'")).toThrow();
    } finally {
      db.close();
    }
  });
});
