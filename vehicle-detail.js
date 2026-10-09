
import { supabase, supabaseConfigured } from "./supabase-client.js";

const container = document.querySelector("#vehicle");

function addText(parent, tag, value, className = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value ?? "";
  parent.append(element);
  return element;
}

function euro(value) {
  if (value === null || value === undefined || value === "") {
    return "Prix sur demande";
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function renderVehicle(vehicle) {
  container.replaceChildren();

  const statusLabels = {
    disponible: "DISPONIBLE",
    a_venir: "À VENIR",
    vendu: "VENDU"
  };

  addText(
    container,
    "span",
    statusLabels[vehicle.status] || "DISPONIBLE",
    "status"
  );

  addText(container, "h1", `${vehicle.make} ${vehicle.model}`);
  addText(
    container,
    "p",
    vehicle.status === "vendu" ? "Vendu" : euro(vehicle.price),
    "price"
  );

  const gallery = document.createElement("div");
  gallery.className = "gallery";

  const photos = Array.isArray(vehicle.photos) ? vehicle.photos : [];

  if (photos.length) {
    photos.forEach((url, index) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = `${vehicle.make} ${vehicle.model} — photo ${index + 1}`;
      img.loading = index === 0 ? "eager" : "lazy";
      img.onerror = () => img.remove();
      gallery.append(img);
    });
  } else {
    addText(gallery, "p", "Aucune photo disponible.");
  }

  container.append(gallery);

  const specs = document.createElement("div");
  specs.className = "specs";

  const details = [
    ["Année", vehicle.year],
    ["Kilométrage", vehicle.mileage != null
      ? `${Number(vehicle.mileage).toLocaleString("fr-FR")} km`
      : null],
    ["Carburant", vehicle.fuel],
    ["Boîte de vitesses", vehicle.gearbox],
    ["Carrosserie", vehicle.body_type],
    ["Nombre de portes", vehicle.doors],
    ["Ajouté le", formatDate(vehicle.created_at)]
  ];

  details.forEach(([label, value]) => {
    if (value === null || value === undefined || value === "") return;
    const item = document.createElement("div");
    item.className = "spec";
    addText(item, "small", label);
    addText(item, "strong", String(value));
    specs.append(item);
  });

  container.append(specs);

  if (vehicle.description) {
    addText(container, "h2", "Description");
    addText(container, "p", vehicle.description);
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const contact = document.createElement("a");
  contact.className = "button primary";
  contact.href = "tel:+33647561765";
  contact.textContent = "Contacter Calicar59";
  actions.append(contact);

  const back = document.createElement("a");
  back.className = "button secondary";
  back.href = "index.html#accueil";
  back.textContent = "Retour au stock";
  actions.append(back);

  container.append(actions);
}

async function init() {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    container.replaceChildren();
    addText(container, "h1", "Véhicule introuvable");
    addText(container, "p", "Aucun véhicule n'a été sélectionné.");
    return;
  }

  if (!supabaseConfigured) {
    container.replaceChildren();
    addText(container, "p", "La connexion à la base de données n'est pas configurée.");
    return;
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select("id, make, model, year, mileage, fuel, gearbox, price, doors, body_type, status, description, photos, created_at")
    .eq("id", id)
    .neq("status", "brouillon")
    .maybeSingle();

  if (error || !data) {
    console.error("CALICAR59 : impossible de charger cette annonce.", error?.message);
    container.replaceChildren();
    addText(container, "h1", "Véhicule indisponible");
    addText(container, "p", "Cette annonce est introuvable ou n'est plus accessible.");
    return;
  }

  renderVehicle(data);
}

init().catch((error) => {
  console.error("CALICAR59 : erreur lors du chargement de la fiche.", error);
  container.replaceChildren();
  addText(container, "p", "Une erreur est survenue lors du chargement du véhicule.");
});
