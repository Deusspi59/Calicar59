import { supabase, supabaseConfigured } from "./supabase-client.js";

const $ = (id) => document.getElementById(id);
const notice = $("globalNotice");
const loginPanel = $("loginPanel");
const dashboard = $("dashboard");
const configWarning = $("configWarning");
const logoutButton = $("logoutButton");
const vehicleFormPanel = $("vehicleFormPanel");
const vehicleForm = $("vehicleForm");
const vehicleList = $("vehicleList");
const existingPhotos = $("existingPhotos");

let currentPhotos = [];
let currentUser = null;

function showNotice(message, kind = "info") {
  notice.textContent = message;
  notice.dataset.kind = kind;
  notice.hidden = false;
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function euro(value) {
  if (value === null || value === undefined || value === "") return "Prix sur demande";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
function statusLabel(status) {
  return ({ disponible: "Disponible", a_venir: "À venir", vendu: "Vendu", brouillon: "Brouillon" })[status] || status;
}
function setLoggedIn(isLoggedIn) {
  loginPanel.hidden = isLoggedIn;
  dashboard.hidden = !isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
}
function resetForm() {
  vehicleForm.reset();
  $("vehicleId").value = "";
  $("vehicleFormTitle").textContent = "Ajouter un véhicule";
  currentPhotos = [];
  renderExistingPhotos();
}
function openNewForm() {
  resetForm();
  vehicleFormPanel.hidden = false;
  $("make").focus();
}
function renderExistingPhotos() {
  existingPhotos.replaceChildren();
  currentPhotos.forEach((path, index) => {
    const wrap = document.createElement("div");
    wrap.className = "admin-photo-item";
    const img = document.createElement("img");
    img.alt = `Photo ${index + 1}`;
    img.src = path;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-button admin-button-muted";
    remove.textContent = "Retirer";
    remove.addEventListener("click", () => {
      currentPhotos = currentPhotos.filter((_, i) => i !== index);
      renderExistingPhotos();
    });
    wrap.append(img, remove);
    existingPhotos.append(wrap);
  });
}

async function loadVehicles() {
  vehicleList.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Chargement des véhicules…";
  vehicleList.append(loading);

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });

  vehicleList.replaceChildren();
  if (error) {
    showNotice(`Impossible de charger les véhicules : ${error.message}`, "error");
    return;
  }
  if (!data?.length) {
    const empty = document.createElement("p");
    empty.textContent = "Aucun véhicule pour le moment. Clique sur « Ajouter un véhicule » pour commencer.";
    vehicleList.append(empty);
    return;
  }

  data.forEach((vehicle) => {
    const row = document.createElement("article");
    row.className = "admin-vehicle-row";
    const image = document.createElement("img");
    image.alt = "";
    image.src = vehicle.photos?.[0] || "";
    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = `${vehicle.make} ${vehicle.model}`;
    const meta = document.createElement("p");
    meta.textContent = [vehicle.year, vehicle.mileage != null ? `${Number(vehicle.mileage).toLocaleString("fr-FR")} km` : "", vehicle.fuel, vehicle.gearbox].filter(Boolean).join(" · ");
    const price = document.createElement("p");
    price.textContent = euro(vehicle.price);
    const status = document.createElement("span");
    status.className = "admin-status";
    status.textContent = statusLabel(vehicle.status);
    info.append(title, meta, price, status);

    const actions = document.createElement("div");
    actions.className = "admin-row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "admin-button admin-button-muted";
    edit.textContent = "Modifier";
    edit.addEventListener("click", () => editVehicle(vehicle));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "admin-button admin-button-muted";
    toggle.textContent = vehicle.featured ? "Retirer la mise en avant" : "Mettre en avant";
    toggle.addEventListener("click", async () => {
      const { error } = await supabase.from("vehicles").update({ featured: !vehicle.featured }).eq("id", vehicle.id);
      if (error) showNotice(`Erreur : ${error.message}`, "error");
      else { showNotice("Mise en avant actualisée.", "success"); await loadVehicles(); }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-button admin-button-muted";
    remove.textContent = "Supprimer";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Supprimer définitivement « ${vehicle.make} ${vehicle.model} » ?`)) return;
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (error) showNotice(`Suppression impossible : ${error.message}`, "error");
      else { showNotice("Véhicule supprimé.", "success"); await loadVehicles(); }
    });
    actions.append(edit, toggle, remove);
    row.append(image, info, actions);
    vehicleList.append(row);
  });
}

function editVehicle(v) {
  resetForm();
  $("vehicleId").value = v.id;
  $("make").value = v.make || "";
  $("model").value = v.model || "";
  $("year").value = v.year ?? "";
  $("mileage").value = v.mileage ?? "";
  $("fuel").value = v.fuel || "";
  $("gearbox").value = v.gearbox || "";
  $("price").value = v.price ?? "";
  $("doors").value = v.doors ?? "";
  $("bodyType").value = v.body_type || "";
  $("status").value = v.status || "brouillon";
  $("description").value = v.description || "";
  $("featured").checked = Boolean(v.featured);
  currentPhotos = Array.isArray(v.photos) ? [...v.photos] : [];
  $("vehicleFormTitle").textContent = `Modifier : ${v.make} ${v.model}`;
  renderExistingPhotos();
  vehicleFormPanel.hidden = false;
  vehicleFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function uploadPhotos(files, vehicleId) {
  const urls = [];
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error(`Format non accepté : ${file.name}`);
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name} dépasse 8 Mo.`);
    }
    const cleanName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${vehicleId}/${crypto.randomUUID()}-${cleanName}`;
    const { error: uploadError } = await supabase.storage.from("vehicle-photos").upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("loginForm").querySelector('button[type="submit"]');
  button.disabled = true;
  showNotice("Connexion en cours…");
  const { error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  button.disabled = false;
  if (error) showNotice(`Connexion impossible : ${error.message}`, "error");
});
logoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) showNotice(`Déconnexion impossible : ${error.message}`, "error");
});
$("newVehicleButton").addEventListener("click", openNewForm);
$("cancelEditButton").addEventListener("click", () => { vehicleFormPanel.hidden = true; resetForm(); });
$("refreshButton").addEventListener("click", loadVehicles);

vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = vehicleForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const id = $("vehicleId").value || crypto.randomUUID();
    const record = {
      id,
      make: $("make").value.trim(),
      model: $("model").value.trim(),
      year: $("year").value ? Number($("year").value) : null,
      mileage: $("mileage").value ? Number($("mileage").value) : null,
      fuel: $("fuel").value || null,
      gearbox: $("gearbox").value || null,
      price: $("price").value ? Number($("price").value) : null,
      doors: $("doors").value ? Number($("doors").value) : null,
      body_type: $("bodyType").value.trim() || null,
      status: $("status").value,
      description: $("description").value.trim() || null,
      featured: $("featured").checked,
      photos: currentPhotos,
      updated_at: new Date().toISOString()
    };

    const { error: saveError } = await supabase.from("vehicles").upsert(record);
    if (saveError) throw saveError;

    const selectedFiles = Array.from($("photos").files || []);
    if (selectedFiles.length) {
      showNotice("Véhicule enregistré. Envoi des photos…");
      const uploadedUrls = await uploadPhotos(selectedFiles, id);
      const mergedPhotos = [...currentPhotos, ...uploadedUrls];
      const { error: photoSaveError } = await supabase.from("vehicles").update({
        photos: mergedPhotos,
        updated_at: new Date().toISOString()
      }).eq("id", id);
      if (photoSaveError) throw photoSaveError;
    }

    showNotice("Véhicule enregistré avec succès.", "success");
    vehicleFormPanel.hidden = true;
    resetForm();
    await loadVehicles();
  } catch (error) {
    showNotice(`Enregistrement impossible : ${error.message || "Erreur inconnue"}`, "error");
  } finally {
    submit.disabled = false;
  }
});

async function init() {
  if (!supabaseConfigured) {
    configWarning.hidden = false;
    loginPanel.hidden = true;
    dashboard.hidden = true;
    showNotice("Configure d'abord supabase-client.js avec les identifiants publics du projet.", "error");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  setLoggedIn(Boolean(currentUser));
  if (currentUser) {
    showNotice(`Connecté : ${currentUser.email}. Vérification des droits…`);
    // Le SQL fourni utilise une table admin_users. Un utilisateur authentifié
    // qui n'y figure pas ne pourra pas lire/modifier les données protégées.
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error || !isAdmin) {
      await supabase.auth.signOut();
      setLoggedIn(false);
      showNotice("Ce compte n'a pas les droits administrateur. Ajoute son identifiant à admin_users dans Supabase.", "error");
      return;
    }
    showNotice("Connexion administrateur réussie.", "success");
    await loadVehicles();
  } else {
    showNotice("Connecte-toi pour gérer les véhicules.");
  }

  supabase.auth.onAuthStateChange((_event, sessionNow) => {
    // Reporte l'état au prochain tour pour éviter les appels imbriqués dans le callback.
    setTimeout(async () => {
      currentUser = sessionNow?.user || null;
      if (!currentUser) {
        setLoggedIn(false);
        return;
      }
      const { data: isAdmin, error } = await supabase.rpc("is_admin");
      if (error || !isAdmin) {
        await supabase.auth.signOut();
        setLoggedIn(false);
        showNotice("Ce compte n'a pas les droits administrateur.", "error");
        return;
      }
      setLoggedIn(true);
      await loadVehicles();
    }, 0);
  });
}
init();
