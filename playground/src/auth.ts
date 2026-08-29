import { betterAuth } from "better-auth";

export const auth = betterAuth({
  baseURL: "http://localhost:4321",
  secret: "playground-secret-must-be-at-least-thirty-two-characters",
});
