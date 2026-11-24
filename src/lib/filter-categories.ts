export const FILTER_SUBCATEGORY_SLUGS = [
  "filtros-combustible",
  "filtros-aceite",
  "filtros-aire",
  "filtros-polen",
  "filtros-caja-cambio",
] as const;

export const FILTER_SUBCATEGORIES = [
  { name: "Filtros de Combustible", slug: "filtros-combustible", imageKey: "filtros" },
  { name: "Filtros de Aceite", slug: "filtros-aceite", imageKey: "filtros" },
  { name: "Filtro de Aire", slug: "filtros-aire", imageKey: "filtros" },
  { name: "Filtros de Polen", slug: "filtros-polen", imageKey: "filtros" },
  { name: "Filtros de Caja de Cambio", slug: "filtros-caja-cambio", imageKey: "filtros" },
] as const;

export const HONDA_FILTER_MODELS = [
  { name: "Civic", slug: "civic", years: "2012–2024" },
  { name: "Fit", slug: "fit", years: "2009–2023" },
  { name: "City", slug: "city", years: "2022–2024" },
  { name: "HR-V", slug: "hr-v", years: "2016–2026" },
  { name: "CR-V", slug: "cr-v", years: "2012–2026" },
  { name: "WR-V", slug: "wr-v", years: "2017–2026" },
  { name: "Accord", slug: "accord", years: "2018–2023" },
  { name: "Pilot", slug: "pilot", years: "2016–2026" },
  { name: "Ridgeline", slug: "ridgeline", years: "2019–2026" },
  { name: "ZR-V", slug: "zr-v", years: "2017–2027" },
  { name: "Odyssey", slug: "odyssey", years: "2013–2022" },
  { name: "Civic Type R", slug: "type-r", years: "2023–2027" },
] as const;
