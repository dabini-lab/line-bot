import * as line from "@line/bot-sdk";
import express from "express";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

const CHANNEL_ID = process.env.CHANNEL_ID;

// create LINE SDK config from env variables
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
});

// dabini engine
const ENGINE_URL = process.env.ENGINE_URL;
const auth = new GoogleAuth();
const engine_client = await auth.getIdTokenClient(ENGINE_URL);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post("/callback", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// event handler
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  const text = event.message.text || "";
  if (text.includes("다빈")) {
    // Get user profile to use as speaker name
    const userId = event.source.userId;
    let userProfile = null;
    try {
      if (userId) {
        userProfile = await client.getProfile(userId);
        console.log("User profile:", userProfile.displayName);
      } else {
        console.error("User ID not found in event source.");
      }
    } catch (error) {
      if (error.statusCode === 404) {
        console.error(`User profile not found for userId ${userId}:`, error);
      } else {
        console.error("Error fetching user profile:", error);
      }
    }

    const requestBody = {
      messages: [text],
      session_id: `line-${CHANNEL_ID}`,
      speaker_name: userProfile ? userProfile.displayName : null,
    };
    const response = await engine_client.request({
      url: `${ENGINE_URL}/messages`,
      method: "POST",
      data: requestBody,
    });
    const reply = { type: "text", text: response.data.response.content };

    // use reply API
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [reply],
    });
  }
}

// listen on port
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`listening on ${port}`);
});
