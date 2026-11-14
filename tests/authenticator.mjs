// Software authenticator for localhost tests only. Exercises production signature verification.
import { generateKeyPairSync, createHash, sign, randomBytes } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { ORIGIN } from "./harness.mjs";
const b64 = (value) => Buffer.from(value).toString("base64url");
const sha = (value) => createHash("sha256").update(value).digest();
export class Authenticator {
  constructor() {
    const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    this.privateKey = pair.privateKey;
    this.jwk = pair.publicKey.export({ format: "jwk" });
    this.id = randomBytes(32);
    this.counter = 0;
  }
  client(challenge, type, origin = ORIGIN) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }
  registration(options, overrides = {}) {
    const clientData = this.client(options.challenge, "webauthn.create", overrides.origin);
    const key = isoCBOR.encode(
      new Map([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(this.jwk.x, "base64url")],
        [-3, Buffer.from(this.jwk.y, "base64url")],
      ]),
    );
    const length = Buffer.alloc(2);
    length.writeUInt16BE(this.id.length);
    const authData = Buffer.concat([
      sha(options.rp.id),
      Buffer.from([overrides.flags ?? 0x45]),
      Buffer.alloc(4),
      Buffer.alloc(16),
      length,
      this.id,
      Buffer.from(key),
    ]);
    const attestation = isoCBOR.encode(
      new Map([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: b64(this.id),
      rawId: b64(this.id),
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64(clientData),
        attestationObject: b64(attestation),
        transports: ["usb"],
      },
    };
  }
  authentication(options, overrides = {}) {
    const clientData = this.client(options.challenge, "webauthn.get", overrides.origin);
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(++this.counter);
    const authData = Buffer.concat([
      sha(options.rpId),
      Buffer.from([overrides.flags ?? 0x05]),
      counter,
    ]);
    const signature = sign("sha256", Buffer.concat([authData, sha(clientData)]), this.privateKey);
    return {
      id: b64(this.id),
      rawId: b64(this.id),
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64(clientData),
        authenticatorData: b64(authData),
        signature: b64(signature),
        userHandle: null,
      },
    };
  }
}
export async function enrollStaff(client, db, userId, role = "admin") {
  await db.batch([
    db
      .prepare("INSERT INTO staff(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING")
      .bind(userId, role),
    db
      .prepare(
        "INSERT INTO admin_security(user_id,state,approval_ref,verified_by) VALUES(?,'pending','fixture-evidence','fixture-operator') ON CONFLICT(user_id) DO NOTHING",
      )
      .bind(userId),
  ]);
  const authenticator = new Authenticator();
  const options = await client.request("/admin-security/register/options", "POST", {});
  if (options.status !== 200) throw new Error(JSON.stringify(options));
  const enrolled = await client.request("/admin-security/register/verify", "POST", {
    id: options.body.id,
    response: authenticator.registration(options.body.options),
  });
  if (enrolled.status !== 200) throw new Error(JSON.stringify(enrolled));
  return { authenticator, recoveryCodes: enrolled.body.recoveryCodes };
}
