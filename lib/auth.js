import crypto from "crypto";

// The session cookie value. Computed identically here (node) and in
// middleware.js (Web Crypto), so the two always agree.
export function sessionToken() {
  return crypto
    .createHash("sha256")
    .update(`${process.env.APP_PASSWORD}:${process.env.AUTH_SECRET}`)
    .digest("hex");
}

export function checkPassword(pw) {
  return Boolean(pw) && pw === process.env.APP_PASSWORD;
}
