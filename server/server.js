import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ path: "./server/.env" });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing from server/.env");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({
    message: "Nova AI server is running",
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Please enter a message.",
      });
    }

    const conversation = history
      .filter(
        (item) =>
          item &&
          typeof item.content === "string" &&
          (item.role === "user" ||
            item.role === "assistant")
      )
      .slice(-10)
      .map((item) => ({
        role:
          item.role === "assistant"
            ? "model"
            : "user",
        parts: [
          {
            text: item.content,
          },
        ],
      }));

    conversation.push({
      role: "user",
      parts: [
        {
          text: message.trim(),
        },
      ],
    });

    const response =
      await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",

        contents: conversation,

        config: {
          systemInstruction:
            "You are Nova, a friendly and helpful AI assistant. Answer clearly, directly and briefly. Keep normal answers below 120 words unless the user asks for a detailed explanation.",

          maxOutputTokens: 300,

          temperature: 0.7,
        },
      });

    const reply = response.text?.trim();

    if (!reply) {
      return res.status(500).json({
        error:
          "The AI did not return a response. Please try again.",
      });
    }

    return res.json({
      reply,
    });
  } catch (error) {
    console.error(
      "Gemini API error:",
      error?.message || error
    );

    if (error?.status === 429) {
      return res.status(429).json({
        error:
          "API usage limit reached. Please wait and try again.",
      });
    }

    if (error?.status === 401 ||
        error?.status === 403) {
      return res.status(error.status).json({
        error:
          "The Gemini API key is invalid or not authorised.",
      });
    }

    if (error?.status === 404) {
      return res.status(404).json({
        error:
          "The selected Gemini model is unavailable.",
      });
    }

    return res.status(500).json({
      error:
        "Unable to generate an AI response. Please try again.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
  });
});

app.listen(PORT, () => {
  console.log(
    `Nova AI server running at http://localhost:${PORT}`
  );
}); 