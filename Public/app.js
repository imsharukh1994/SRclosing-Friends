/* =========================================================
   SR AI CHAT - CLOUDFLARE VERSION
   ========================================================= */

(function initAIChat() {

  // Prevent duplicate initialization
  if (document.getElementById("srAiChatPanel")) {
    return;
  }

  /* =========================================================
     CREATE FLOATING AI BUTTON
     ========================================================= */

  const chatButton = document.createElement("button");

  chatButton.id = "srAiChatButton";
  chatButton.className = "ai-chat-button";
  chatButton.type = "button";
  chatButton.title = "Open SR AI Assistant";

  chatButton.innerHTML = `
    <span class="ai-chat-icon">✦</span>
    <span class="ai-chat-badge">AI</span>
  `;

  document.body.appendChild(chatButton);


  /* =========================================================
     CREATE CHAT PANEL
     ========================================================= */

  const chatPanel = document.createElement("div");

  chatPanel.id = "srAiChatPanel";
  chatPanel.className = "ai-chat-panel";

  chatPanel.innerHTML = `

    <div class="ai-chat-header">

      <div class="ai-chat-title">

        <div class="ai-chat-avatar">
          ✦
        </div>

        <div>
          <strong>SR AI Assistant</strong>
          <span>IT Helpdesk Closure Copilot</span>
        </div>

      </div>

      <button
        type="button"
        class="ai-chat-close"
        id="srAiChatClose"
        title="Close"
      >
        ×
      </button>

    </div>


    <div
      class="ai-chat-messages"
      id="srAiChatMessages"
    >

      <div class="ai-message">

        <div class="ai-message-avatar">
          AI
        </div>

        <div class="ai-message-content">

          <div class="ai-message-name">
            SR AI Assistant
          </div>

          <div class="ai-message-bubble">
            Hi! I'm your SR Closure AI Assistant.
            <br><br>
            I can help you find quick-win SRs, decide what to work on
            next, explain blockers, and prepare requester messages.
            <br><br>
            What would you like to know?
          </div>

        </div>

      </div>

    </div>


    <div class="ai-chat-suggestions">

      <button
        type="button"
        data-chat="What SRs should I close first?"
      >
        What should I close first?
      </button>

      <button
        type="button"
        data-chat="Show me the oldest open SRs."
      >
        Oldest SRs
      </button>

      <button
        type="button"
        data-chat="Find quick wins in my SR backlog."
      >
        Quick wins
      </button>

      <button
        type="button"
        data-chat="Which SRs need requester follow-up?"
      >
        Requester follow-up
      </button>

    </div>


    <div class="ai-chat-input-area">

      <input
        id="srAiChatInput"
        class="ai-chat-input"
        type="text"
        placeholder="Ask about your SRs..."
        autocomplete="off"
      />

      <button
        id="srAiChatSend"
        class="ai-chat-send"
        type="button"
        title="Send"
      >
        ➤
      </button>

    </div>

  `;

  document.body.appendChild(chatPanel);


  /* =========================================================
     ELEMENTS
     ========================================================= */

  const closeButton =
    document.getElementById("srAiChatClose");

  const messages =
    document.getElementById("srAiChatMessages");

  const input =
    document.getElementById("srAiChatInput");

  const sendButton =
    document.getElementById("srAiChatSend");


  /* =========================================================
     OPEN / CLOSE
     ========================================================= */

  function openChat() {

    chatPanel.classList.add("open");

    setTimeout(() => {
      input.focus();
    }, 150);

  }


  function closeChat() {

    chatPanel.classList.remove("open");

  }


  chatButton.addEventListener(
    "click",
    openChat
  );


  closeButton.addEventListener(
    "click",
    closeChat
  );


  /* =========================================================
     GET CURRENT SR DATA
     ========================================================= */

  function getChatRequests() {

    let requests = [];


    /*
     * First try common localStorage keys.
     */

    const possibleKeys = [
      "srRequests",
      "requests",
      "srData",
      "importedRequests",
      "srTracker",
      "sr_closure_requests",
      "srClosureData"
    ];


    for (const key of possibleKeys) {

      try {

        const raw =
          localStorage.getItem(key);

        if (!raw) {
          continue;
        }


        const parsed =
          JSON.parse(raw);


        if (Array.isArray(parsed)) {

          requests = parsed;

          if (requests.length) {
            break;
          }

        }


        if (
          parsed &&
          Array.isArray(parsed.requests)
        ) {

          requests =
            parsed.requests;

          if (requests.length) {
            break;
          }

        }

      } catch (error) {

        console.warn(
          "Could not read localStorage:",
          key,
          error
        );

      }

    }


    /*
     * Try global application arrays.
     */

    if (
      !requests.length &&
      Array.isArray(window.requests)
    ) {

      requests =
        window.requests;

    }


    if (
      !requests.length &&
      Array.isArray(window.srRequests)
    ) {

      requests =
        window.srRequests;

    }


    /*
     * Try common application variables.
     */

    if (
      !requests.length &&
      typeof window.getRequests === "function"
    ) {

      try {

        const result =
          window.getRequests();

        if (Array.isArray(result)) {

          requests =
            result;

        }

      } catch (error) {

        console.warn(
          "getRequests() failed:",
          error
        );

      }

    }


    return requests;

  }


  /* =========================================================
     GET DASHBOARD CONTEXT
     ========================================================= */

  function getChatContext() {

    const requests =
      getChatRequests();


    const openCount =
      document.getElementById("openCount")
        ?.textContent || "0";


    const closedToday =
      document.getElementById("closedToday")
        ?.textContent || "0";


    const target =
      document.getElementById("targetInput")
        ?.value || "10";


    const ready =
      document.getElementById("ready")
        ?.textContent || "0";


    const old60 =
      document.getElementById("old60")
        ?.textContent || "0";


    const old30 =
      document.getElementById("old30")
        ?.textContent || "0";


    const stale =
      document.getElementById("stale")
        ?.textContent || "0";


    /*
     * Send only a reasonable amount of data.
     * This prevents huge Gemini requests.
     */

    const limitedRequests =
      requests.slice(0, 100);


    return {

      today:
        new Date()
          .toISOString()
          .slice(0, 10),

      deadline:
        "2027-01-01",

      target:
        Number(target) || 10,

      closedToday:
        Number(closedToday) || 0,

      dashboard: {

        open:
          Number(openCount) || 0,

        readyToClose:
          Number(ready) || 0,

        old60:
          Number(old60) || 0,

        old30:
          Number(old30) || 0,

        stale:
          Number(stale) || 0

      },

      totalRequests:
        requests.length,

      requests:
        limitedRequests

    };

  }


  /* =========================================================
     ADD MESSAGE
     ========================================================= */

  function addMessage(
    text,
    type = "ai"
  ) {

    const wrapper =
      document.createElement("div");


    wrapper.className =
      type === "user"
        ? "ai-message ai-message-user"
        : "ai-message";


    const avatar =
      document.createElement("div");


    avatar.className =
      "ai-message-avatar";


    avatar.textContent =
      type === "user"
        ? "You"
        : "AI";


    const content =
      document.createElement("div");


    content.className =
      "ai-message-content";


    const name =
      document.createElement("div");


    name.className =
      "ai-message-name";


    name.textContent =
      type === "user"
        ? "You"
        : "SR AI Assistant";


    const bubble =
      document.createElement("div");


    bubble.className =
      "ai-message-bubble";


    /*
     * Escape HTML.
     */

    const safeText =
      String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");


    bubble.innerHTML =
      safeText;


    content.appendChild(name);
    content.appendChild(bubble);

    wrapper.appendChild(avatar);
    wrapper.appendChild(content);

    messages.appendChild(wrapper);


    messages.scrollTop =
      messages.scrollHeight;

  }


  /* =========================================================
     THINKING INDICATOR
     ========================================================= */

  function showThinking() {

    hideThinking();


    const wrapper =
      document.createElement("div");


    wrapper.id =
      "aiThinkingMessage";


    wrapper.className =
      "ai-message";


    wrapper.innerHTML = `

      <div class="ai-message-avatar">
        AI
      </div>

      <div class="ai-message-content">

        <div class="ai-message-name">
          SR AI Assistant
        </div>

        <div class="ai-chat-thinking">

          <span></span>
          <span></span>
          <span></span>

        </div>

      </div>

    `;


    messages.appendChild(wrapper);


    messages.scrollTop =
      messages.scrollHeight;

  }


  function hideThinking() {

    const thinking =
      document.getElementById(
        "aiThinkingMessage"
      );


    if (thinking) {

      thinking.remove();

    }

  }


  /* =========================================================
     SEND MESSAGE TO CLOUDFLARE WORKER
     ========================================================= */

  async function sendMessage(
    customMessage = null
  ) {

    const message =
      String(
        customMessage ??
        input.value ??
        ""
      ).trim();


    if (!message) {
      return;
    }


    input.value = "";


    addMessage(
      message,
      "user"
    );


    showThinking();


    sendButton.disabled = true;
    input.disabled = true;


    try {

      const context =
        getChatContext();


      console.log(
        "🤖 Sending AI chat request",
        {
          message,
          context
        }
      );


      const response =
        await fetch(
          "/api/ai/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                message,
                context
              })
          }
        );


      let data;


      try {

        data =
          await response.json();

      } catch {

        throw new Error(
          "Cloudflare returned an invalid response."
        );

      }


      if (!response.ok) {

        throw new Error(
          data?.error ||
          `AI request failed (${response.status})`
        );

      }


      if (!data?.reply) {

        throw new Error(
          "AI returned an empty response."
        );

      }


      hideThinking();


      addMessage(
        data.reply,
        "ai"
      );


    } catch (error) {

      console.error(
        "❌ AI chat error:",
        error
      );


      hideThinking();


      addMessage(
        "❌ " +
        (
          error?.message ||
          "AI chat could not complete the request."
        ),
        "ai"
      );


    } finally {

      sendButton.disabled = false;
      input.disabled = false;

      input.focus();

    }

  }


  /* =========================================================
     SEND BUTTON
     ========================================================= */

  sendButton.addEventListener(
    "click",
    () => {
      sendMessage();
    }
  );


  /* =========================================================
     ENTER KEY
     ========================================================= */

  input.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();

      }

    }
  );


  /* =========================================================
     QUICK QUESTIONS
     ========================================================= */

  document
    .querySelectorAll(
      ".ai-chat-suggestions button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const question =
            button.dataset.chat;


          if (question) {

            sendMessage(
              question
            );

          }

        }
      );

    });


  /* =========================================================
     ESCAPE TO CLOSE
     ========================================================= */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        chatPanel.classList.contains("open")
      ) {

        closeChat();

      }

    }
  );


  /* =========================================================
     DEBUG
     ========================================================= */

  console.log(
    "✅ SR AI Chat initialized"
  );

  console.log(
    "📊 SR records available to AI:",
    getChatRequests().length
  );


})();