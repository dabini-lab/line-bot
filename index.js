import * as line from "@line/bot-sdk";
import express from "express";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

const CHANNEL_ID = process.env.CHANNEL_ID;

// create LINE SDK config from env variables
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  maxReplyMessages: 5, // Add the message limit here
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

  const message = event.message;
  const text = message.text || "";
  // Check if the bot is mentioned in the message
  const isBotMentioned =
    message.mention &&
    message.mention.mentionees &&
    message.mention.mentionees.some(
      (mentionee) => mentionee.userId === CHANNEL_ID
    );

  if (isBotMentioned) {
    // Get user profile to use as speaker name
    const userId = event.source.userId;
    let userProfile = null;
    try {
      if (userId) {
        userProfile = await client.getProfile(userId);
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

    const messages = response.data.messages;
    // Limit the number of messages based on config
    const limitedMessages = messages.slice(0, config.maxReplyMessages);

    // Map the limited messages to the LINE reply format
    const replies = limitedMessages.map((message) => ({
      type: "text",
      text: message,
    }));

    // Check if there are any replies to send
    if (replies.length > 0) {
      // use reply API to send all limited messages at once
      return client.replyMessage({
        replyToken: event.replyToken,
        messages: replies,
      });
    } else {
      // No messages to send back
      return Promise.resolve(null);
    }
  }
  // Handle cases where the bot is not mentioned
  return Promise.resolve(null);
}

// listen on port
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`listening on ${port}`);
});
