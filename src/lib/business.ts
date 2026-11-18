/**
 * Business configuration. Values left as null are pending confirmation by Honda Logistics
 * and the UI shows a neutral "a confirmar" message instead of inventing data.
 */
export const BUSINESS = {
  name: "Honda Logistics",
  domain: "hondalogistics.com.uy",
  bankTransfer: null as null | { bank: string; accountHolder: string; accountNumber: string; currency: string },
  storeAddress: null as null | string,
  contactPhone: null as null | string,
  contactEmail: null as null | string,
};
