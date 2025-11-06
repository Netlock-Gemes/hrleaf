import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();

export const githubSignIn = async () => {
  const data = await authClient.signIn.social({
    provider: "github",
  });
};

export const { signIn, signUp, useSession } = createAuthClient();
