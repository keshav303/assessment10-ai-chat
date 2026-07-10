import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const createNewChat = () => ({
  id: Date.now().toString(),
  title: "New conversation",
  messages: [
    {
      id: Date.now(),
      role: "assistant",
      content:
        "Hello! I’m Nova, your AI assistant. How can I help you today?",
    },
  ],
}); 

function App() {
  const [chats, setChats] = useState(() => {
    const savedChats = localStorage.getItem("ai-chat-history");

    if (savedChats) {
      try {
        return JSON.parse(savedChats);
      } catch {
        return [createNewChat()];
      }
    }

    return [createNewChat()];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    const savedActiveId = localStorage.getItem("active-chat-id");

    if (savedActiveId) {
      return savedActiveId;
    }

    const savedChats = localStorage.getItem("ai-chat-history");

    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats);
        return parsedChats[0]?.id || "";
      } catch {
        return "";
      }
    }

    return "";
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) || chats[0];

  useEffect(() => {
    if (chats.length > 0 && !activeChatId) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  useEffect(() => {
    localStorage.setItem("ai-chat-history", JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem("active-chat-id", activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [activeChat?.messages, isLoading]);

  const updateChatById = (chatId, updater) => {
    setChats((previousChats) =>
      previousChats.map((chat) =>
        chat.id === chatId ? updater(chat) : chat
      )
    );
  };

  const createChat = () => {
    const newChat = createNewChat();

    setChats((previousChats) => [newChat, ...previousChats]);
    setActiveChatId(newChat.id);
    setInput("");
    setSidebarOpen(false);
  };

  const deleteChat = (event, chatId) => {
    event.stopPropagation();

    setChats((previousChats) => {
      const remainingChats = previousChats.filter(
        (chat) => chat.id !== chatId
      );

      if (remainingChats.length === 0) {
        const newChat = createNewChat();
        setActiveChatId(newChat.id);
        return [newChat];
      }

      if (chatId === activeChatId) {
        setActiveChatId(remainingChats[0].id);
      }

      return remainingChats;
    });
  };

  const clearAllChats = () => {
    const newChat = createNewChat();

    setChats([newChat]);
    setActiveChatId(newChat.id);
    setInput("");
    setSidebarOpen(false);
  };

  const sendMessage = async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || isLoading || !activeChat) {
      return;
    }

    const chatIdForRequest = activeChat.id;
    const previousMessages = activeChat.messages;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: trimmedInput,
    };

    const isFirstUserMessage =
      previousMessages.filter(
        (message) => message.role === "user"
      ).length === 0;

    updateChatById(chatIdForRequest, (chat) => ({
      ...chat,
      title: isFirstUserMessage
        ? trimmedInput.slice(0, 32)
        : chat.title,
      messages: [...chat.messages, userMessage],
    }));

    setInput("");
    setIsLoading(true);

    try {
      const historyForApi = previousMessages.filter(
        (message) =>
          !(
            message.role === "assistant" &&
            message.content.startsWith("Hello! I’m Nova")
          )
      );

      const response = await fetch(
        "http://localhost:5000/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmedInput,
            history: historyForApi,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to generate an AI response."
        );
      }

      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.reply,
      };

      updateChatById(chatIdForRequest, (chat) => ({
        ...chat,
        messages: [...chat.messages, assistantMessage],
      }));
    } catch (error) {
      console.error("Chat error:", error);

      const errorMessage = {
        id: Date.now() + 2,
        role: "assistant",
        content:
          error.message ||
          "Unable to connect to the AI server. Please try again.",
        isError: true,
      };

      updateChatById(chatIdForRequest, (chat) => ({
        ...chat,
        messages: [...chat.messages, errorMessage],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const exportConversation = () => {
    if (!activeChat) {
      return;
    }

    const conversationText = activeChat.messages
      .map(
        (message) =>
          `${
            message.role === "user" ? "You" : "Nova"
          }:\n${message.content}`
      )
      .join("\n\n");

    const file = new Blob([conversationText], {
      type: "text/plain",
    });

    const fileUrl = URL.createObjectURL(file);
    const downloadLink = document.createElement("a");

    downloadLink.href = fileUrl;
    downloadLink.download = `${
      activeChat.title || "conversation"
    }.txt`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(fileUrl);
  };

  return (
    <div className="app">
      <div
        className={`sidebar-overlay ${
          sidebarOpen ? "show" : ""
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">✦</div>

          <div>
            <h1>Nova AI</h1>
            <p>Smart conversations</p>
          </div>

          <button
            className="close-sidebar"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={createChat}
        >
          <span>＋</span>
          New chat
        </button>

        <div className="history-heading">
          <span>Chat history</span>
          <span>{chats.length}</span>
        </div>

        <div className="chat-list">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-history-item ${
                chat.id === activeChatId ? "active" : ""
              }`}
              onClick={() => {
                setActiveChatId(chat.id);
                setSidebarOpen(false);
              }}
            >
              <span className="history-icon">💬</span>

              <span className="history-content">
                <strong>{chat.title}</strong>

                <small>
                  {chat.messages.length > 1
                    ? `${chat.messages.length - 1} messages`
                    : "No messages yet"}
                </small>
              </span>

              <span
                className="delete-chat"
                role="button"
                tabIndex="0"
                title="Delete chat"
                onClick={(event) =>
                  deleteChat(event, chat.id)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    deleteChat(event, chat.id);
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>

        <button
          className="clear-history-button"
          onClick={clearAllChats}
        >
          🗑 Clear all history
        </button>
      </aside>

      <main className="chat-area">
        <header className="chat-header">
          <div className="header-left">
            <button
              className="menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>

            <div className="assistant-avatar">✦</div>

            <div>
              <h2>Nova AI Assistant</h2>

              <div className="online-status">
                <span />
                Online
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              onClick={exportConversation}
              title="Export conversation"
            >
              ⇩
              <span>Export</span>
            </button>

            <button
              onClick={createChat}
              title="Start new conversation"
            >
              ＋
              <span>New chat</span>
            </button>
          </div>
        </header>

        <section className="messages-container">
          <div className="messages">
            {activeChat?.messages.map((message) => (
              <div
                key={message.id}
                className={`message-row ${message.role}`}
              >
                <div className="message-avatar">
                  {message.role === "assistant"
                    ? "✦"
                    : "You"}
                </div>

                <div
                  className={`message-bubble ${
                    message.isError ? "error-message" : ""
                  }`}
                >
                  <div className="markdown-content">
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </div>

                  <time>
                    {new Date(
                      Number(message.id)
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-row assistant">
                <div className="message-avatar">✦</div>

                <div className="message-bubble typing-bubble">
                  <div className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>

        <footer className="composer-section">
          <div className="suggestion-row">
            <button
              onClick={() =>
                setInput(
                  "Explain artificial intelligence in simple words"
                )
              }
            >
              Explain AI simply
            </button>

            <button
              onClick={() =>
                setInput(
                  "Help me create a daily study schedule"
                )
              }
            >
              Create a study plan
            </button>

            <button
              onClick={() =>
                setInput(
                  "Give me five creative project ideas"
                )
              }
            >
              Project ideas
            </button>
          </div>

          <div className="composer">
            <textarea
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Ask Nova anything..."
              rows="1"
              disabled={isLoading}
            />

            <button
              className="send-button"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              ➤
            </button>
          </div>

          <p className="composer-note">
            Press Enter to send · Shift + Enter for a new line
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;