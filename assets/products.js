/* Fallback / demo product data.
 * Used only when COOLPRO_CONFIG.productsCsvUrl is empty or cannot be loaded.
 * Prices and SEER values are ILLUSTRATIVE — replace via your Google Sheet (see SETUP.md).
 * sizes: { <BTU/h>: { p: price incl. standard install (THB), seer: SEER (BTU/Wh), model: model code } }
 */
window.COOLPRO_PRODUCTS = [
    { id: "wf-elite", type: "wall", name: "Wind-Free Elite", tag: "ขายดี",
      desc: "ติดผนัง เย็นแบบไม่มีลมเป่าโดนตัว + Wi-Fi SmartThings",
      feats: ["Wind-Free", "AI Auto Cooling", "PM1.0 Filter"],
      sizes: { 9000: { p: 23900, seer: 24 }, 12000: { p: 26900, seer: 23 }, 18000: { p: 34900, seer: 22 }, 24000: { p: 44900, seer: 20 } } },
    { id: "wf-std", type: "wall", name: "Wind-Free Standard",
      desc: "ติดผนัง Inverter รุ่นคุ้มค่า สำหรับบ้านและคอนโด",
      feats: ["Wind-Free", "Digital Inverter", "Fast Cooling"],
      sizes: { 9000: { p: 18900, seer: 21 }, 12000: { p: 21500, seer: 20 }, 18000: { p: 28900, seer: 19 }, 24000: { p: 37900, seer: 18 } } },
    { id: "cst-4way", type: "cassette", name: "Wind-Free 4-Way Cassette", tag: "งานพาณิชย์",
      desc: "ฝังฝ้า 4 ทิศทาง กระจายลมทั่วห้อง สำหรับออฟฟิศและร้านค้า",
      feats: ["360° airflow", "Wind-Free", "Motion sensor (option)"],
      sizes: { 24000: { p: 52900, seer: 17 }, 30000: { p: 61900, seer: 16.5 }, 36000: { p: 69900, seer: 16 }, 48000: { p: 84900, seer: 15 } } },
    { id: "cst-1way", type: "cassette", name: "Wind-Free 1-Way Cassette",
      desc: "ฝังฝ้าแบบบาง เหมาะกับห้องยาวหรือมุมห้อง",
      feats: ["Slim body", "Wind-Free", "Quiet"],
      sizes: { 12000: { p: 36900, seer: 18 }, 18000: { p: 43900, seer: 17 }, 24000: { p: 51900, seer: 16 } } },
    { id: "cf", type: "ceiling", name: "Ceiling & Floor",
      desc: "แขวนใต้ฝ้าหรือตั้งพื้น ส่งลมได้ไกล เหมาะกับห้องโถงและร้านอาหาร",
      feats: ["Long throw", "Auto swing", "Inverter"],
      sizes: { 18000: { p: 39900, seer: 16 }, 24000: { p: 46900, seer: 15.5 }, 36000: { p: 62900, seer: 15 }, 48000: { p: 78900, seer: 14 } } },
  ];
