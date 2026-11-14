// Plans only: no remote access and no claim that human verification has occurred.
export function bootstrapSQL({ email, approval, operator }) {
  if (
    email !== "admin@afnancollectionkn.com" ||
    !/^[A-Za-z0-9:_./-]{3,120}$/.test(approval ?? "") ||
    !/^[A-Za-z0-9:_./-]{3,120}$/.test(operator ?? "")
  )
    throw new Error(
      "Exact owner email, restricted evidence reference and operator reference are required",
    );
  const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
  return `INSERT INTO user(id,name,email,email_verified,created_at,updated_at)
SELECT lower(hex(randomblob(16))),'Afnan owner',${quote(email)},0,unixepoch()*1000,unixepoch()*1000
WHERE NOT EXISTS(SELECT 1 FROM user WHERE lower(email)=${quote(email)});
INSERT INTO admin_security(user_id,state,approval_ref,verified_by)
SELECT id,'pending',${quote(approval)},${quote(operator)} FROM user WHERE email=${quote(email)}
ON CONFLICT(user_id) DO NOTHING;
INSERT INTO staff(user_id,role) SELECT u.id,'admin' FROM user u JOIN admin_security s ON s.user_id=u.id
WHERE u.email=${quote(email)} AND s.state='pending' ON CONFLICT(user_id) DO NOTHING;
INSERT INTO audit(actor,action,entity_id)
SELECT ${quote(operator)},'admin.bootstrap.pending',u.id FROM user u JOIN admin_security s ON s.user_id=u.id
WHERE u.email=${quote(email)} AND s.state='pending' AND NOT EXISTS(SELECT 1 FROM audit WHERE action='admin.bootstrap.pending' AND entity_id=u.id);`;
}
