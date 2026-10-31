/* ============================================================
 * CoolPro HVAC — site configuration
 * Edit only this file to connect the site to your own services.
 * See SETUP.md for step-by-step instructions.
 * ============================================================ */
window.COOLPRO_CONFIG = {
  // Google Sheet "Products" tab → File › Share › Publish to web › CSV.
  // Leave empty to use the built-in demo data in assets/products.js.
  productsCsvUrl: "",

  // Google Apps Script Web App URL (ends with /exec). Receives quote and project leads.
  // Leave empty and the forms fall back to "copy quote" + LINE button.
  leadEndpoint: "",

  // Your LINE Official Account add-friend link, e.g. "https://lin.ee/AbCdEfG".
  lineOaUrl: "",

  // Shown in the footer and quote text.
  phone: "",
  quoteFooter: "* ราคารวมติดตั้งมาตรฐาน (ท่อน้ำยาไม่เกิน 4 ม.) ราคายืนยันหลังสำรวจหน้างาน",

  // Business rules
  vatRate: 0.07,
  volumeDiscount: { minUnits: 3, rate: 0.05 },
};
