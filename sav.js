import { supabase } from "./supabase-client.js";

const $ = (id) => document.getElementById(id);

const authPanel = $("authPanel");
const inboxPanel = $("inboxPanel");
const notice = $("savNotice");
const conversationList = $("conversationList");
const threadPanel = $("threadPanel");
const messagesBox = $("messages");

let currentUser = null;
let activeConversationId = null;
let activeConversationStatus = null;
let isAdmin = false;
let realtimeChannel = null;

// Afficher un message
function showNotice(message, type = "") {
  notice.textContent = message;
  notice.className = "sav-notice";

  if (type) {
    notice.classList.add("sav-" + type);
  }
}

// Formater une date
function formatDate(value) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

// Afficher l'espace connecté
function showAuthenticatedUI(user) {
  currentUser = user;

  authPanel.classList.add("sav-hidden");
  inboxPanel.classList.remove("sav-hidden");

  $("signedInAs").textContent =
    "Connecté : " + (user.email || "");
}

// Afficher l'espace de connexion
function showAuthUI() {
  currentUser = null;
  activeConversationId = null;
  activeConversationStatus = null;
  isAdmin = false;

  authPanel.classList.remove("sav-hidden");
  inboxPanel.classList.add("sav-hidden");
  threadPanel.classList.add("sav-hidden");

  conversationList.replaceChildren();
  messagesBox.replaceChildren();

  $("conversationTitle").textContent =
    "Mes conversations";

  $("newConversation").classList.remove(
    "sav-hidden"
  );

  $("adminConversationActions").classList.add(
    "sav-hidden"
  );

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// Afficher le formulaire d'inscription
$("showSignup").addEventListener(
  "click",
  function () {
    $("loginForm").classList.add("sav-hidden");
    $("signupForm").classList.remove("sav-hidden");

    showNotice("");
  }
);

// Revenir au formulaire de connexion
$("showLogin").addEventListener(
  "click",
  function () {
    $("signupForm").classList.add("sav-hidden");
    $("loginForm").classList.remove("sav-hidden");

    showNotice("");
  }
);

// Créer un compte client
$("signupForm").addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    const button = event.submitter;

    if (button) {
      button.disabled = true;
    }

    showNotice("Création du compte...");

    try {
      const result = await supabase.auth.signUp({
        email: $("signupEmail").value.trim(),
        password: $("signupPassword").value
      });

      if (result.error) {
        throw result.error;
      }

      if (result.data.session) {
        await initializeSession(
          result.data.session.user
        );

        showNotice(
          "Compte créé avec succès.",
          "success"
        );
      } else {
        showNotice(
          "Compte créé. Vérifiez votre boîte e-mail pour confirmer votre inscription, puis connectez-vous.",
          "success"
        );

        $("signupForm").reset();

        $("signupForm").classList.add(
          "sav-hidden"
        );

        $("loginForm").classList.remove(
          "sav-hidden"
        );
      }
    } catch (error) {
      showNotice(
        "Création impossible : " +
          error.message,
        "error"
      );
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }
);

// Connexion
$("loginForm").addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    const button = event.submitter;

    if (button) {
      button.disabled = true;
    }

    showNotice("Connexion...");

    try {
      const result =
        await supabase.auth.signInWithPassword({
          email: $("email").value.trim(),
          password: $("password").value
        });

      if (result.error) {
        throw result.error;
      }

      await initializeSession(
        result.data.user
      );

      showNotice(
        "Connexion réussie.",
        "success"
      );
    } catch (error) {
      showNotice(
        "Connexion impossible : " +
          error.message,
        "error"
      );
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }
);

// Déconnexion
$("logout").addEventListener(
  "click",
  async function () {
    const result =
      await supabase.auth.signOut();

    if (result.error) {
      showNotice(
        "Déconnexion impossible : " +
          result.error.message,
        "error"
      );

      return;
    }

    showAuthUI();

    showNotice(
      "Vous êtes déconnecté.",
      "success"
    );
  }
);

// Initialiser la session
async function initializeSession(user) {
  currentUser = user;

  const result = await supabase
    .from("sav_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (result.error) {
    throw new Error(
      "Impossible de vérifier les droits SAV."
    );
  }

  isAdmin = Boolean(result.data);

  showAuthenticatedUI(user);

  $("conversationTitle").textContent =
    isAdmin
      ? "Demandes SAV clients"
      : "Mes conversations";

  $("newConversation").classList.toggle(
    "sav-hidden",
    isAdmin
  );

  if (isAdmin) {
    $("newConversationForm").classList.add(
      "sav-hidden"
    );
  }

  await loadConversations();
}

// Afficher le formulaire de nouvelle demande
$("newConversation").addEventListener(
  "click",
  function () {
    $("newConversationForm").classList.toggle(
      "sav-hidden"
    );
  }
);

// Créer une nouvelle conversation
$("newConversationForm").addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    if (!currentUser || isAdmin) {
      return;
    }

    const button = event.submitter;

    if (button) {
      button.disabled = true;
    }

    try {
      const subject =
        $("subject").value.trim();

      const content =
        $("firstMessage").value.trim();

      if (!subject || !content) {
        throw new Error(
          "Veuillez renseigner l'objet et le message."
        );
      }

      const conversationResult =
        await supabase
          .from("sav_conversations")
          .insert({
            customer_id: currentUser.id,
            subject: subject
          })
          .select("id")
          .single();

      if (conversationResult.error) {
        throw conversationResult.error;
      }

      const conversationId =
        conversationResult.data.id;

      const messageResult =
        await supabase
          .from("sav_messages")
          .insert({
            conversation_id:
              conversationId,

            sender_id:
              currentUser.id,

            content:
              content
          });

      if (messageResult.error) {
        throw new Error(
          "La demande a été créée mais le message n'a pas pu être envoyé : " +
            messageResult.error.message
        );
      }

      $("newConversationForm").reset();

      $("newConversationForm").classList.add(
        "sav-hidden"
      );

      showNotice(
        "Demande SAV envoyée.",
        "success"
      );

      await loadConversations();

      await openConversation(
        conversationId
      );
    } catch (error) {
      showNotice(
        "Envoi impossible : " +
          error.message,
        "error"
      );
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }
);

// Charger les conversations
async function loadConversations() {
  conversationList.textContent =
    "Chargement...";

  const result = await supabase
    .from("sav_conversations")
    .select(
      "id, subject, status, created_at, updated_at"
    )
    .order(
      "updated_at",
      { ascending: false }
    );

  if (result.error) {
    conversationList.textContent =
      "Impossible de charger les conversations.";

    showNotice(
      "Erreur : " +
        result.error.message,
      "error"
    );

    return;
  }

  conversationList.replaceChildren();

  const conversations =
    result.data || [];

  if (conversations.length === 0) {
    conversationList.textContent =
      isAdmin
        ? "Aucune demande SAV pour le moment."
        : "Vous n'avez pas encore de conversation.";

    return;
  }

  conversations.forEach(
    function (conversation) {
      const button =
        document.createElement("button");

      button.type = "button";

      button.setAttribute(
        "aria-pressed",
        String(
          conversation.id ===
            activeConversationId
        )
      );

      const title =
        document.createElement("strong");

      title.textContent =
        conversation.subject;

      const metadata =
        document.createElement("span");

      metadata.style.display =
        "block";

      metadata.style.marginTop =
        "5px";

      metadata.style.color =
        "#91a4c4";

      let statusLabel =
        conversation.status;

      if (
        conversation.status ===
        "en_attente"
      ) {
        statusLabel = "en attente";
      }

      if (
        conversation.status ===
        "ferme"
      ) {
        statusLabel = "fermée";
      }

      if (
        conversation.status ===
        "ouvert"
      ) {
        statusLabel = "ouverte";
      }

      metadata.textContent =
        statusLabel +
        " - " +
        formatDate(
          conversation.created_at
        );

      button.append(
        title,
        metadata
      );

      button.addEventListener(
        "click",
        function () {
          openConversation(
            conversation.id
          );
        }
      );

      conversationList.append(
        button
      );
    }
  );
}

// Ouvrir une conversation
async function openConversation(
  conversationId
) {
  activeConversationId =
    conversationId;

  threadPanel.classList.remove(
    "sav-hidden"
  );

  $("threadTitle").textContent =
    "Conversation SAV";

  messagesBox.textContent =
    "Chargement des messages...";

  const result = await supabase
    .from("sav_conversations")
    .select(
      "id, subject, status, customer_id"
    )
    .eq(
      "id",
      conversationId
    )
    .maybeSingle();

  if (
    result.error ||
    !result.data
  ) {
    messagesBox.textContent =
      "Conversation inaccessible.";

    showNotice(
      "Vous ne pouvez pas accéder à cette conversation.",
      "error"
    );

    return;
  }

  const conversation =
    result.data;

  activeConversationStatus =
    conversation.status;

  $("threadTitle").textContent =
    conversation.subject;

  // Bouton admin Fermer / Rouvrir
  if (isAdmin) {
    $("adminConversationActions")
      .classList
      .remove("sav-hidden");

    updateAdminStatusButton();
  } else {
    $("adminConversationActions")
      .classList
      .add("sav-hidden");
  }

  // Un client ne peut plus répondre
  // si la conversation est fermée
  const replyDisabled =
    conversation.status === "ferme" &&
    !isAdmin;

  $("replyText").disabled =
    replyDisabled;

  $("replyForm")
    .querySelector("button")
    .disabled =
      replyDisabled;

  if (
    replyDisabled
  ) {
    $("replyText").placeholder =
      "Cette conversation est fermée.";
  } else {
    $("replyText").placeholder =
      "Écrivez votre message…";
  }

  await loadMessages(
    conversationId
  );

  await loadConversations();

  subscribeToMessages(
    conversationId
  );
}

// Mettre à jour le bouton admin
function updateAdminStatusButton() {
  if (!isAdmin) {
    return;
  }

  const button =
    $("closeConversation");

  if (
    activeConversationStatus ===
    "ferme"
  ) {
    button.textContent =
      "Rouvrir la conversation";
  } else {
    button.textContent =
      "Fermer la conversation";
  }
}

// Fermer ou rouvrir une conversation
$("closeConversation")
  .addEventListener(
    "click",
    async function () {
      if (
        !isAdmin ||
        !activeConversationId
      ) {
        return;
      }

      const button =
        $("closeConversation");

      button.disabled = true;

      try {
        const newStatus =
          activeConversationStatus ===
          "ferme"
            ? "ouvert"
            : "ferme";

        const result =
          await supabase
            .from("sav_conversations")
            .update({
              status: newStatus,
              updated_at:
                new Date().toISOString()
            })
            .eq(
              "id",
              activeConversationId
            )
            .select(
              "id, status"
            )
            .single();

        if (result.error) {
          throw result.error;
        }

        activeConversationStatus =
          result.data.status;

        updateAdminStatusButton();

        await loadConversations();

        if (
          activeConversationStatus ===
          "ferme"
        ) {
          showNotice(
            "Conversation fermée.",
            "success"
          );
        } else {
          showNotice(
            "Conversation rouverte.",
            "success"
          );
        }
      } catch (error) {
        showNotice(
          "Impossible de modifier la conversation : " +
            error.message,
          "error"
        );
      } finally {
        button.disabled = false;
      }
    }
  );

// Charger les messages
async function loadMessages(
  conversationId
) {
  const result = await supabase
    .from("sav_messages")
    .select(
      "id, sender_id, content, created_at"
    )
    .eq(
      "conversation_id",
      conversationId
    )
    .order(
      "created_at",
      { ascending: true }
    );

  if (result.error) {
    messagesBox.textContent =
      "Impossible de charger les messages.";

    showNotice(
      "Erreur : " +
        result.error.message,
      "error"
    );

    return;
  }

  messagesBox.replaceChildren();

  const messages =
    result.data || [];

  messages.forEach(
    function (message) {
      const bubble =
        document.createElement("div");

      bubble.className =
        "sav-message";

      if (
        message.sender_id ===
        currentUser.id
      ) {
        bubble.classList.add(
          "mine"
        );
      }

      const content =
        document.createElement(
          "div"
        );

      content.textContent =
        message.content;

      const time =
        document.createElement(
          "small"
        );

      let senderLabel = "";

      if (
        message.sender_id ===
        currentUser.id
      ) {
        senderLabel = "Vous";
      } else if (isAdmin) {
        senderLabel = "Client";
      } else {
        senderLabel =
          "Service SAV";
      }

      time.textContent =
        senderLabel +
        " - " +
        formatDate(
          message.created_at
        );

      bubble.append(
        content,
        time
      );

      messagesBox.append(
        bubble
      );
    }
  );

  messagesBox.scrollTop =
    messagesBox.scrollHeight;
}

// Temps réel
function subscribeToMessages(
  conversationId
) {
  if (realtimeChannel) {
    supabase.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }

  realtimeChannel =
    supabase
      .channel(
        "sav-messages-" +
          conversationId
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sav_messages",
          filter:
            "conversation_id=eq." +
            conversationId
        },
        function () {
          loadMessages(
            conversationId
          );
        }
      )
      .subscribe();
}

// Envoyer une réponse
$("replyForm").addEventListener(
  "submit",
  async function (event) {
    event.preventDefault();

    if (
      !currentUser ||
      !activeConversationId
    ) {
      return;
    }

    // Blocage supplémentaire côté client
    if (
      !isAdmin &&
      activeConversationStatus ===
        "ferme"
    ) {
      showNotice(
        "Cette conversation est fermée.",
        "error"
      );

      return;
    }

    const button =
      event.submitter;

    const content =
      $("replyText")
        .value
        .trim();

    if (!content) {
      return;
    }

    if (button) {
      button.disabled = true;
    }

    try {
      const result =
        await supabase
          .from("sav_messages")
          .insert({
            conversation_id:
              activeConversationId,

            sender_id:
              currentUser.id,

            content:
              content
          });

      if (result.error) {
        throw result.error;
      }

      $("replyText").value =
        "";

      await loadMessages(
        activeConversationId
      );

      await loadConversations();

      showNotice(
        "Message envoyé.",
        "success"
      );
    } catch (error) {
      showNotice(
        "Envoi impossible : " +
          error.message,
        "error"
      );
    } finally {
      if (button) {
        button.disabled =
          false;
      }
    }
  }
);

// Détection de déconnexion
supabase.auth.onAuthStateChange(
  function (event) {
    if (
      event ===
      "SIGNED_OUT"
    ) {
      showAuthUI();
    }
  }
);

// Démarrage
async function startApp() {
  const result =
    await supabase.auth.getSession();

  if (result.error) {
    showNotice(
      "Impossible de vérifier la session. Rechargez la page.",
      "error"
    );

    return;
  }

  if (
    result.data.session &&
    result.data.session.user
  ) {
    try {
      await initializeSession(
        result.data.session.user
      );
    } catch (error) {
      showNotice(
        error.message,
        "error"
      );
    }
  }
}

startApp();