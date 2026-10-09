
import { supabase, supabaseConfigured } from "./supabase-client.js";

const STATUS_LABELS = {
  disponible: "DISPONIBLE",
  a_venir: "À VENIR",
  vendu: "VENDU"
};

function text(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value ?? "";
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

function vehicleCard(vehicle, index) {
  const article = document.createElement("article");
  article.className = `vehicle-card${vehicle.featured ? " featured" : ""}`;
  article.tabIndex = 0;
  article.setAttribute("role", "link");
  article.setAttribute(
    "aria-label",
    `Voir le détail du véhicule ${vehicle.make} ${vehicle.model}`
  );
  article.style.cursor = "pointer";

  const openDetails = () => {
    window.location.href =
      `vehicle.html?id=${encodeURIComponent(vehicle.id)}`;
  };

  article.addEventListener("click", (event) => {
    // Préserve le fonctionnement des liens et boutons de la carte.
    if (event.target.closest("a, button")) return;
    openDetails();
  });

  article.addEventListener("keydown", (event) => {
    if (event.target !== article) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails();
    }
  });

  const picture = document.createElement("div");
  picture.className =
    `vehicle-picture ${["picture-blue", "picture-cyan", "picture-dark"][index % 3]}`;

  const status = text(
    "span",
    "vehicle-status",
    STATUS_LABELS[vehicle.status] || "DISPONIBLE"
  );

  if (vehicle.status === "a_venir") status.classList.add("coming");

  const imageUrl = vehicle.photos?.[0];

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = `${vehicle.make} ${vehicle.model}`;
    img.loading = "lazy";
    img.style.cssText =
      "width:100%;height:100%;object-fit:cover;border-radius:inherit;";
    picture.append(img);
  } else {
    picture.append(text("div", "fake-car", "🚘"));
  }

  picture.append(
    status,
    text("span", "vehicle-number", String(index + 1).padStart(2, "0"))
  );

  const info = document.createElement("div");
  info.className = "vehicle-info";

  info.append(
    text("span", "vehicle-type", vehicle.body_type || "OCCASION"),
    text("h3", "", `${vehicle.make} ${vehicle.model}`),
    text("p", "", [
      vehicle.year,
      vehicle.mileage != null
        ? `${Number(vehicle.mileage).toLocaleString("fr-FR")} km`
        : "",
      vehicle.fuel,
      vehicle.gearbox
    ].filter(Boolean).join(" · "))
  );

  const footer = document.createElement("div");
  footer.className = "vehicle-footer";

  footer.append(
    text(
      "strong",
      "",
      vehicle.status === "vendu" ? "Vendu" : euro(vehicle.price)
    )
  );

  const contact = document.createElement("a");
  contact.href = "tel:+33647561765";
  contact.append(
    document.createTextNode(
      vehicle.status === "vendu"
        ? "Nous contacter "
        : "Contacter Calicar59 "
    ),
    text("span", "", "↗")
  );

  footer.append(contact);
  info.append(footer);
  article.append(picture, info);

  return article;
}

export async function loadPublicVehicles(
  target = document.querySelector(".stock-grid")
) {
  if (!target) {
    console.warn("CALICAR59 : élément .stock-grid introuvable.");
    return;
  }

  if (!supabaseConfigured) {
    console.warn("CALICAR59 : configuration Supabase manquante.");
    return;
  }

  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, make, model, year, mileage, fuel, gearbox, price, doors, body_type, status, description, photos, featured, created_at"
    )
    .neq("status", "brouillon")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "CALICAR59 : chargement des véhicules impossible.",
      error.message
    );
    return;
  }

  target.replaceChildren();

  if (!data?.length) {
    target.append(
      text("p", "vehicle-empty", "Nos prochains véhicules seront affichés ici.")
    );
    return;
  }

  data.forEach((vehicle, index) => {
    target.append(vehicleCard(vehicle, index));
  });
}
