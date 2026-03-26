/**
 * chat_widget.js — Floating chat panel for LeadStreet BI Dashboard.
 *
 * Injected by chat_server.py at runtime. Self-contained, no dependencies.
 * Does NOT exist in the static GitHub Pages build.
 */
(function () {
  "use strict";

  // --- State ---
  var messages = [];
  var isOpen = false;
  var isLoading = false;

  // --- Styles ---
  var style = document.createElement("style");
  style.textContent = [
    "#chat-toggle{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3498DB,#2C7ABF);color:#fff;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(52,152,219,.35);z-index:10000;display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;font-size:22px}",
    "#chat-toggle:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(52,152,219,.45)}",
    "#chat-panel{position:fixed;bottom:88px;right:24px;width:420px;max-height:560px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15),0 2px 8px rgba(0,0,0,.08);z-index:10000;display:none;flex-direction:column;overflow:hidden;border:1px solid #E4E7EC;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif}",
    "#chat-panel.open{display:flex}",
    "#chat-header{background:linear-gradient(135deg,#1E2530,#161B22);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}",
    "#chat-header h3{font-size:14px;font-weight:600;letter-spacing:-.2px;margin:0}",
    "#chat-header .sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;font-weight:500}",
    "#chat-close{background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:18px;padding:4px 8px;border-radius:6px;transition:all .15s}",
    "#chat-close:hover{background:rgba(255,255,255,.1);color:#fff}",
    "#chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;min-height:200px;max-height:380px}",
    ".chat-msg{max-width:92%;line-height:1.5;font-size:13px}",
    ".chat-msg.user{align-self:flex-end;background:#3498DB;color:#fff;padding:10px 14px;border-radius:14px 14px 4px 14px}",
    ".chat-msg.bot{align-self:flex-start;background:#F0F2F5;color:#1A1D21;padding:12px 16px;border-radius:14px 14px 14px 4px}",
    ".chat-msg.bot .answer{margin-bottom:0}",
    ".chat-msg.bot .sql-toggle{display:block;margin-top:8px;font-size:11px;color:#5F6B7A;cursor:pointer;font-weight:500;user-select:none}",
    ".chat-msg.bot .sql-toggle:hover{color:#3498DB}",
    ".chat-msg.bot .sql-block{display:none;margin-top:8px;padding:10px 12px;background:#1E2530;color:#A8D8A8;border-radius:8px;font-family:'SF Mono',Menlo,Monaco,monospace;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-all;max-height:140px;overflow-y:auto}",
    ".chat-msg.bot .sql-block.show{display:block}",
    ".chat-msg.error{color:#E74C3C}",
    ".chat-loading{align-self:flex-start;padding:12px 16px;background:#F0F2F5;border-radius:14px 14px 14px 4px;font-size:13px;color:#98A2B3}",
    ".chat-loading .dots{display:inline-block;animation:dotPulse 1.4s infinite}",
    "@keyframes dotPulse{0%,80%,100%{opacity:.3}40%{opacity:1}}",
    "#chat-input-bar{display:flex;padding:12px 16px;border-top:1px solid #E4E7EC;background:#FAFBFC;gap:8px;flex-shrink:0}",
    "#chat-input{flex:1;padding:10px 14px;border:1px solid #E4E7EC;border-radius:10px;font-size:13px;font-family:inherit;color:#1A1D21;background:#fff;outline:none;transition:border-color .15s}",
    "#chat-input:focus{border-color:#3498DB;box-shadow:0 0 0 3px rgba(52,152,219,.1)}",
    "#chat-input::placeholder{color:#98A2B3}",
    "#chat-send{padding:10px 18px;background:#3498DB;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s;white-space:nowrap}",
    "#chat-send:hover{background:#2C7ABF}",
    "#chat-send:disabled{background:#B0D4F1;cursor:not-allowed}",
    ".chat-welcome{text-align:center;padding:24px 16px;color:#5F6B7A;font-size:13px;line-height:1.6}",
    ".chat-welcome strong{color:#1A1D21;font-size:14px;display:block;margin-bottom:8px}",
    ".chat-welcome .examples{margin-top:12px;text-align:left}",
    ".chat-welcome .example{display:block;padding:8px 12px;margin:4px 0;background:#F8F9FA;border-radius:8px;cursor:pointer;font-size:12px;color:#3498DB;transition:background .15s;border:1px solid transparent}",
    ".chat-welcome .example:hover{background:#EBF5FB;border-color:#B0D4F1}",
    /* Markdown table styles */
    ".chat-msg.bot table{border-collapse:collapse;margin-top:8px;font-size:12px;width:100%}",
    ".chat-msg.bot th,.chat-msg.bot td{padding:4px 8px;border:1px solid #E4E7EC;text-align:left}",
    ".chat-msg.bot th{background:#F0F2F5;font-weight:600;font-size:11px;color:#5F6B7A}",
  ].join("\n");
  document.head.appendChild(style);

  // --- Toggle button ---
  var toggle = document.createElement("button");
  toggle.id = "chat-toggle";
  toggle.innerHTML = "&#128172;";
  toggle.title = "Chat with your data";
  toggle.onclick = function () {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    if (isOpen) inputEl.focus();
  };
  document.body.appendChild(toggle);

  // --- Panel ---
  var panel = document.createElement("div");
  panel.id = "chat-panel";
  panel.innerHTML = [
    '<div id="chat-header">',
    '  <div><h3>Chat with your data</h3><div class="sub">Powered by Claude</div></div>',
    '  <button id="chat-close">&times;</button>',
    "</div>",
    '<div id="chat-messages"></div>',
    '<div id="chat-input-bar">',
    '  <input id="chat-input" type="text" placeholder="Ask about your data..." autocomplete="off">',
    '  <button id="chat-send">Send</button>',
    "</div>",
  ].join("\n");
  document.body.appendChild(panel);

  var messagesEl = document.getElementById("chat-messages");
  var inputEl = document.getElementById("chat-input");
  var sendBtn = document.getElementById("chat-send");

  document.getElementById("chat-close").onclick = function () {
    isOpen = false;
    panel.classList.remove("open");
  };

  // --- Welcome message ---
  function showWelcome() {
    messagesEl.innerHTML = [
      '<div class="chat-welcome">',
      "  <strong>Ask anything about your Productive data</strong>",
      "  I'll write SQL, run it, and summarize the results.",
      '  <div class="examples">',
      '    <span class="example" data-q="What is our billable utilisation this year?">What is our billable utilisation this year?</span>',
      '    <span class="example" data-q="Show me the top 5 clients by revenue">Show me the top 5 clients by revenue</span>',
      '    <span class="example" data-q="Which deals are overbudget?">Which deals are overbudget?</span>',
      '    <span class="example" data-q="Who has the lowest note compliance?">Who has the lowest note compliance?</span>',
      "  </div>",
      "</div>",
    ].join("\n");

    messagesEl.querySelectorAll(".example").forEach(function (el) {
      el.onclick = function () {
        inputEl.value = el.getAttribute("data-q");
        sendMessage();
      };
    });
  }
  showWelcome();

  // --- Simple markdown → HTML (tables + bold + line breaks) ---
  function renderMarkdown(text) {
    // Convert markdown tables
    var lines = text.split("\n");
    var html = [];
    var inTable = false;
    var headerDone = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.match(/^\|.*\|$/)) {
        // Table row
        if (line.match(/^\|[\s\-:|]+\|$/)) {
          // Separator row — skip
          continue;
        }
        if (!inTable) {
          html.push("<table>");
          inTable = true;
          headerDone = false;
        }
        var cells = line
          .split("|")
          .filter(function (c) {
            return c.trim() !== "";
          })
          .map(function (c) {
            return c.trim();
          });
        if (!headerDone) {
          html.push(
            "<tr>" +
              cells
                .map(function (c) {
                  return "<th>" + c + "</th>";
                })
                .join("") +
              "</tr>"
          );
          headerDone = true;
        } else {
          html.push(
            "<tr>" +
              cells
                .map(function (c) {
                  return "<td>" + c + "</td>";
                })
                .join("") +
              "</tr>"
          );
        }
      } else {
        if (inTable) {
          html.push("</table>");
          inTable = false;
        }
        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        html.push(line ? "<p>" + line + "</p>" : "");
      }
    }
    if (inTable) html.push("</table>");
    return html.join("");
  }

  // --- Render messages ---
  function render() {
    // Keep welcome if no messages
    if (messages.length === 0) {
      showWelcome();
      return;
    }

    var html = "";
    messages.forEach(function (m) {
      if (m.role === "user") {
        html +=
          '<div class="chat-msg user">' + escapeHtml(m.content) + "</div>";
      } else {
        var sqlBlock = "";
        if (m.sql) {
          var id = "sql-" + Math.random().toString(36).substr(2, 6);
          sqlBlock =
            '<span class="sql-toggle" onclick="var b=document.getElementById(\'' +
            id +
            "');b.classList.toggle('show');this.textContent=b.classList.contains('show')?'Hide SQL':'Show SQL'\">Show SQL</span>" +
            '<div class="sql-block" id="' +
            id +
            '">' +
            escapeHtml(m.sql) +
            "</div>";
        }
        html +=
          '<div class="chat-msg bot">' +
          '<div class="answer">' +
          renderMarkdown(m.content) +
          "</div>" +
          sqlBlock +
          "</div>";
      }
    });

    if (isLoading) {
      html +=
        '<div class="chat-loading"><span class="dots">Thinking...</span></div>';
    }

    messagesEl.innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(text) {
    var d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
  }

  // --- Send message ---
  function sendMessage() {
    var question = inputEl.value.trim();
    if (!question || isLoading) return;

    inputEl.value = "";
    messages.push({ role: "user", content: question });
    isLoading = true;
    sendBtn.disabled = true;
    render();

    // Build conversation context (last 4 messages)
    var conversation = messages
      .slice(-5, -1)
      .map(function (m) {
        return {
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        };
      });

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, conversation: conversation }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        messages.push({
          role: "assistant",
          content: data.answer || "No response.",
          sql: data.sql || null,
        });
      })
      .catch(function (err) {
        messages.push({
          role: "assistant",
          content: "Connection error: " + err.message,
          sql: null,
        });
      })
      .finally(function () {
        isLoading = false;
        sendBtn.disabled = false;
        render();
        inputEl.focus();
      });
  }

  sendBtn.onclick = sendMessage;
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
