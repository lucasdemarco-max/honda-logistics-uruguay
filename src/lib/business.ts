/**
 * Business configuration. Values left as null are pending confirmation by Honda Logistics
 * and the UI shows a neutral "a confirmar" message instead of inventing data.
 */
export const BUSINESS = {
  name: "Honda Logistics",
  whatsapp: { display: "094 483 008", url: "https://wa.me/59894483008" },
  domain: "hondalogistics.com.uy",
  bankTransfer: null as null | { bank: string; accountHolder: string; accountNumber: string; currency: string },
  storeAddress: null as null | string,
  contactPhone: null as null | string,
  contactEmail: null as null | string,
};
