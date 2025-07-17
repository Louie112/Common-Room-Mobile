import { GoogleAuth } from "google-auth-library";

export interface MessagePayload {
  token: string;
  notification: {
    title: string;
    body: string;
  };
  data?: Record<string, string>;
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  
  const client = await auth.getClient();
  const accessTokenResponse = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResponse === "string"
      ? accessTokenResponse
      : accessTokenResponse.token;
  
  return accessToken as string;
}

export async function sendPushNotification(message: MessagePayload): Promise<any> {
  const projectId = "louiepersonalfirebase"; 
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const accessToken = await getAccessToken();

  // Dynamically import node-fetch to avoid CommonJS/ESM conflicts.
  const { default: fetch } = await import("node-fetch");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return await response.json();
}