/* =========================================================
   SR AI CHAT - CLOUDFLARE VERSION
   Complete AI Chat Module
   ========================================================= */

(function initAIChat() {

  /* =========================================================
     PREVENT DUPLICATE INITIALIZATION
     ========================================================= */

  if (document.getElementById("srAiChatPanel")) {
    console.log("ℹ️ SR AI Chat already initialized");
    return;
  }


  /* =========================================================
     CREATE FLOATING AI BUTTON
     ========================================================= */

  const chatButton =
    document.createElement("button");

  chatButton.id =
    "srAiChatButton";

  chatButton.className =
    "ai-chat-button";

  chatButton.type =
    "button";

  chatButton.title =
    "Open SR AI Assistant";

  chatButton.innerHTML = `
    <span class="ai-chat-icon">✦</span>
    <span class="ai-chat-badge">AI</span>
  `;

  document.body.appendChild(chatButton);


  /* =========================================================
     CREATE CHAT PANEL
     ========================================================= */

  const chatPanel =
    document.createElement("div");

  chatPanel.id =
    "srAiChatPanel";

  chatPanel.className =
    "ai-chat-panel";


  chatPanel.innerHTML = `

    <div class="ai-chat-header">

      <div class="ai-chat-title">

        <div class="ai-chat-avatar">
          ✦
        </div>

        <div>

          <strong>
            SR AI Assistant
          </strong>

          <span>
            IT Helpdesk Closure Copilot
          </span>

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

            I can help you:

            <br>
            • Find quick-win SRs
            <br>
            • Decide what to work on next
            <br>
            • Find old or stale SRs
            <br>
            • Prepare requester messages
            <br>
            • Explain blockers

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
     GET ELEMENTS
     ========================================================= */

  const closeButton =
    document.getElementById(
      "srAiChatClose"
    );


  const messages =
    document.getElementById(
      "srAiChatMessages"
    );


  const input =
    document.getElementById(
      "srAiChatInput"
    );


  const sendButton =
    document.getElementById(
      "srAiChatSend"
    );


  /* =========================================================
     OPEN CHAT
     ========================================================= */

  function openChat() {

    chatPanel.classList.add(
      "open"
    );


    setTimeout(() => {

      if (input) {
        input.focus();
      }

    }, 150);

  }


  /* =========================================================
     CLOSE CHAT
     ========================================================= */

  function closeChat() {

    chatPanel.classList.remove(
      "open"
    );

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
     GET SR DATA
     ========================================================= */

  function getChatRequests() {

    let requests = [];


    /*
     * IMPORTANT:
     * Main SR Closure Manager storage.
     */

    const MAIN_STORAGE_KEY =
      "sr_closure_manager_v6_final";


    try {

      const raw =
        localStorage.getItem(
          MAIN_STORAGE_KEY
        );


      if (raw) {

        const parsed =
          JSON.parse(raw);


        if (
          parsed &&
          Array.isArray(
            parsed.requests
          )
        ) {

          requests =
            parsed.requests;

        }

      }

    } catch (error) {

      console.error(
        "❌ Main SR storage error:",
        error
      );

    }


    /*
     * Fallback storage keys.
     */

    if (!requests.length) {

      const possibleKeys = [

        "srRequests",
        "requests",
        "srData",
        "importedRequests",
        "srTracker",
        "sr_closure_requests",
        "srClosureData"

      ];


      for (
        const key of possibleKeys
      ) {

        try {

          const raw =
            localStorage.getItem(
              key
            );


          if (!raw) {
            continue;
          }


          const parsed =
            JSON.parse(raw);


          if (
            Array.isArray(parsed)
          ) {

            requests =
              parsed;

          }


          if (
            parsed &&
            Array.isArray(
              parsed.requests
            )
          ) {

            requests =
              parsed.requests;

          }


          if (
            requests.length
          ) {

            break;

          }

        } catch (error) {

          console.warn(
            "⚠️ Could not read:",
            key,
            error
          );

        }

      }

    }


    /*
     * Try global requests variable.
     */

    if (
      !requests.length &&
      Array.isArray(
        window.requests
      )
    ) {

      requests =
        window.requests;

    }


    /*
     * Try global srRequests.
     */

    if (
      !requests.length &&
      Array.isArray(
        window.srRequests
      )
    ) {

      requests =
        window.srRequests;

    }


    /*
     * Try application getter.
     */

    if (
      !requests.length &&
      typeof window.getRequests ===
        "function"
    ) {

      try {

        const result =
          window.getRequests();


        if (
          Array.isArray(result)
        ) {

          requests =
            result;

        }

      } catch (error) {

        console.warn(
          "⚠️ getRequests() failed:",
          error
        );

      }

    }


    console.log(
      "📊 SR records available to AI:",
      requests.length
    );


    return requests;

  }


  /* =========================================================
     GET DASHBOARD CONTEXT
     ========================================================= */

  function getChatContext() {

    const requests =
      getChatRequests();


    const openCount =
      document
        .getElementById(
          "openCount"
        )
        ?.textContent ||
      "0";


    const closedToday =
      document
        .getElementById(
          "closedToday"
        )
        ?.textContent ||
      "0";


    const target =
      document
        .getElementById(
          "targetInput"
        )
        ?.value ||
      "10";


    const ready =
      document
        .getElementById(
          "ready"
        )
        ?.textContent ||
      "0";


    const old60 =
      document
        .getElementById(
          "old60"
        )
        ?.textContent ||
      "0";


    const old30 =
      document
        .getElementById(
          "old30"
        )
        ?.textContent ||
      "0";


    const stale =
      document
        .getElementById(
          "stale"
        )
        ?.textContent ||
      "0";


    /*
     * Only send useful SR fields.
     */

    const limitedRequests =
      requests
        .slice(0, 100)
        .map(sr => ({

          id:
            sr.id || "",

          subject:
            sr.subject || "",

          requester:
            sr.requester || "",

          technician:
            sr.technician || "",

          status:
            sr.status || "",

          priority:
            sr.priority || "",

          site:
            sr.site || "",

          category:
            sr.category || "",

          created:
            sr.created || "",

          updated:
            sr.updated || "",

          ageDays:
            sr.ageDays || "",

          stage:
            sr.myStage ||
            "New",

          nextAction:
            sr.nextAction ||
            "",

          resolution:
            sr.resolution ||
            "",

          notes:
            sr.notes ||
            "",

          followupDate:
            sr.followupDate ||
            "",

          closeReady:
            Boolean(
              sr.closeReady
            )

        }));


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
     ADD CHAT MESSAGE
     ========================================================= */

  function addMessage(
    text,
    type = "ai"
  ) {

    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.className =
      type === "user"
        ? "ai-message ai-message-user"
        : "ai-message";


    const avatar =
      document.createElement(
        "div"
      );


    avatar.className =
      "ai-message-avatar";


    avatar.textContent =
      type === "user"
        ? "You"
        : "AI";


    const content =
      document.createElement(
        "div"
      );


    content.className =
      "ai-message-content";


    const name =
      document.createElement(
        "div"
      );


    name.className =
      "ai-message-name";


    name.textContent =
      type === "user"
        ? "You"
        : "SR AI Assistant";


    const bubble =
      document.createElement(
        "div"
      );


    bubble.className =
      "ai-message-bubble";


    /*
     * Escape HTML.
     */

    const safeText =
      String(text || "")
        .replace(
          /&/g,
          "&amp;"
        )
        .replace(
          /</g,
          "&lt;"
        )
        .replace(
          />/g,
          "&gt;"
        )
        .replace(
          /\n/g,
          "<br>"
        );


    bubble.innerHTML =
      safeText;


    content.appendChild(
      name
    );


    content.appendChild(
      bubble
    );


    wrapper.appendChild(
      avatar
    );


    wrapper.appendChild(
      content
    );


    messages.appendChild(
      wrapper
    );


    messages.scrollTop =
      messages.scrollHeight;

  }


  /* =========================================================
     THINKING INDICATOR
     ========================================================= */

  function showThinking() {

    hideThinking();


    const wrapper =
      document.createElement(
        "div"
      );


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


    messages.appendChild(
      wrapper
    );


    messages.scrollTop =
      messages.scrollHeight;

  }


  /* =========================================================
     HIDE THINKING
     ========================================================= */

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
     SEND MESSAGE TO CLOUDFLARE
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


    /*
     * Clear input.
     */

    input.value = "";


    /*
     * Show user message.
     */

    addMessage(
      message,
      "user"
    );


    /*
     * Show AI thinking.
     */

    showThinking();


    sendButton.disabled =
      true;

    input.disabled =
      true;


    try {

      /*
       * Get current SR data.
       */

      const context =
        getChatContext();


      console.log(
        "🤖 Sending AI request:",
        {
          message,
          totalSRs:
            context.totalRequests
        }
      );


      /*
       * Call Cloudflare Worker.
       */

      const response =
        await fetch(
          "/api/ai/chat",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                message:

                  message,

                context:

                  context

              })

          }
        );


      /*
       * Parse response.
       */

      let data;


      try {

        data =
          await response.json();

      } catch {

        throw new Error(
          "Cloudflare returned an invalid response."
        );

      }


      /*
       * Handle HTTP errors.
       */

      if (!response.ok) {

        throw new Error(
          data?.error ||
          `AI request failed (${response.status})`
        );

      }


      /*
       * Validate AI response.
       */

      if (
        !data ||
        !data.reply
      ) {

        throw new Error(
          "AI returned an empty response."
        );

      }


      /*
       * Remove thinking.
       */

      hideThinking();


      /*
       * Show AI response.
       */

      addMessage(
        data.reply,
        "ai"
      );


    } catch (error) {

      console.error(
        "❌ AI Chat Error:",
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

      sendButton.disabled =
        false;


      input.disabled =
        false;


      input.focus();

    }

  }


  /* =========================================================
     SEND BUTTON
     ========================================================= */

  sendButton.addEventListener(
    "click",
    function () {

      sendMessage();

    }
  );


  /* =========================================================
     ENTER KEY
     ========================================================= */

  input.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key ===
          "Enter" &&
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
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const question =
              button.dataset.chat;


            if (
              question
            ) {

              sendMessage(
                question
              );

            }

          }
        );

      }
    );


  /* =========================================================
     ESCAPE TO CLOSE
     ========================================================= */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key ===
          "Escape" &&
        chatPanel.classList.contains(
          "open"
        )
      ) {

        closeChat();

      }

    }
  );


  /* =========================================================
     DEBUG INFORMATION
     ========================================================= */

  console.log(
    "✅ SR AI Chat initialized"
  );


  console.log(
    "📊 SR records available to AI:",
    getChatRequests().length
  );


})();